from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol, Sequence
from uuid import uuid4

from pydantic import ValidationError

from app.extraction.errors import ExtractionProviderError, UnreadableResponseError
from app.extraction.evidence import validate_evidence
from app.extraction.settings import PROJECT_DIR, Settings
from app.schemas import Extraction


@dataclass(frozen=True)
class ImageInput:
    data: bytes
    mime_type: str


class Extractor(Protocol):
    def extract(self, images: Sequence[ImageInput]) -> Extraction: ...


SYSTEM_INSTRUCTION = """You read packaged-food label photographs for evidence display. You do not compare against a dietary profile and do not make safety or health claims.
Transcribe visible words exactly as printed: do not correct, translate, summarize, normalize, infer, or complete cropped text. Use null when a value is not readable. Never invent an ingredient, allergen, nutrition value, serving basis, product fact, date, or batch code.
For each uploaded image, emit one image record with its zero-based upload index, best visible role, quality, and a short note. Inspect for focus or motion blur, cropping, glare, curved or folded packaging, and partial obstruction by a hand, sticker, seam, or other visible object. Use only the existing image-quality values. Put a concise, visible cause in note when it affects reading; do not guess a cause that is not visible or imply a calibrated quality score. Curved text or partial obstruction may make a section readable_partial or unreadable even when other parts of the photo are clear. For each of the four sections, use readable_complete only when the panel appears fully visible and readable; readable_partial when partly visible/readable; unreadable when present but too unclear to read reliably; not_uploaded when no relevant panel is visible; ambiguous when its identity or meaning is unclear. Keep the exact section transcript in text when legible and give a concise reason when status is not readable_complete. If a section is readable but has no extracted rows, preserve its transcript and use reason to say no matching item was detected in readable text; do not claim absence.
Every ingredient, allergen phrase, nutrition row, and package fact must include an exact evidence_quote copied from its matching section transcript and the source image index. If a quote cannot be copied exactly, omit that row and explain uncertainty in warnings. Keep allergen phrases separated into contains, may_contain, and other. Preserve nutrition amount, unit, and basis only when visible; do not infer missing pieces. Package facts are photo readings only. Keep product name, brand, and quantity in product when visible and represent each as an evidence-backed package_fact as well.
Describe a vegetarian/non-vegetarian symbol only in marks.visual_description; never represent a symbol as a text quote. Use veg_mark, nonveg_mark, or uncertain_diet_mark. Mark unclear readings for review with a reason. Use suggested_group only for a non-obvious ingredient group and label it unverified in its note. Never return a confidence probability.
Set analysis_id to an empty string; the backend will assign it. Include every required field, including empty arrays and nullable values. Do not include any dietary profile or user preference."""

RETRY_INSTRUCTION = "The prior response did not validate. Return one complete JSON object matching the provided schema. Preserve exact source text; do not add prose or markdown."


class MockExtractor:
    def __init__(self) -> None:
        self.fixture_path = PROJECT_DIR / "shared" / "fixtures" / "extraction" / "clear_peanut_alias.json"

    def extract(self, images: Sequence[ImageInput]) -> Extraction:
        if not images:
            raise ValueError("At least one image is required.")
        try:
            payload = json.loads(self.fixture_path.read_text(encoding="utf-8"))
            payload["analysis_id"] = uuid4().hex
            extraction = Extraction.model_validate(payload)
            return validate_evidence(extraction, len(images))
        except (OSError, json.JSONDecodeError, ValidationError, ValueError) as exc:
            raise UnreadableResponseError() from exc


class GeminiExtractor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def extract(self, images: Sequence[ImageInput]) -> Extraction:
        if not self.settings.gemini_api_key:
            raise ExtractionProviderError(
                "Live extraction is not configured. Set GEMINI_API_KEY in backend/.env.",
                retryable=False,
            )
        if not images:
            raise ValueError("At least one image is required.")

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise ExtractionProviderError(
                "The Gemini SDK is not installed. Install backend/requirements.txt.",
                retryable=False,
            ) from exc

        image_parts = [
            types.Part.from_bytes(data=image.data, mime_type=image.mime_type)
            for image in images
        ]
        base_contents: list[object] = [
            "Read these package label image(s). Keep image indexes in upload order, starting at zero.",
            *image_parts,
        ]

        try:
            with genai.Client(api_key=self.settings.gemini_api_key) as client:
                for attempt in range(2):
                    contents = base_contents if attempt == 0 else [*base_contents, RETRY_INSTRUCTION]
                    try:
                        response = client.models.generate_content(
                            model=self.settings.gemini_model,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=Extraction,
                                temperature=0,
                                max_output_tokens=16_000,
                            ),
                        )
                    except Exception as exc:
                        raise self._provider_error(exc) from None

                    raw_text = getattr(response, "text", None)
                    if not isinstance(raw_text, str) or not raw_text.strip():
                        if attempt == 0:
                            continue
                        raise UnreadableResponseError()

                    try:
                        extraction = Extraction.model_validate_json(raw_text)
                        data = extraction.model_dump()
                        data["analysis_id"] = uuid4().hex
                        extraction = Extraction.model_validate(data)
                        return validate_evidence(
                            extraction, len(images), require_each_image=True
                        )
                    except (ValidationError, ValueError, TypeError):
                        if attempt == 0:
                            continue
                        raise UnreadableResponseError() from None
        except ExtractionProviderError:
            raise
        except Exception as exc:
            raise self._provider_error(exc) from None

        raise UnreadableResponseError()

    @staticmethod
    def _provider_error(exc: Exception) -> ExtractionProviderError:
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        message = str(exc).lower()
        try:
            status_number = int(status)
        except (TypeError, ValueError):
            status_number = None

        if status_number == 429 or "resource_exhausted" in message or "quota" in message:
            return ExtractionProviderError(
                "Gemini quota is temporarily exhausted. Please try again later.",
                retryable=True,
                quota=True,
            )
        invalid_key = "api key not valid" in message or "invalid api key" in message
        if invalid_key or status_number in {401, 403} or "permission_denied" in message or "unauthenticated" in message:
            return ExtractionProviderError(
                "Gemini rejected the backend credential or project access. Check GEMINI_API_KEY in backend/.env.",
                retryable=False,
            )
        if status_number == 400:
            return ExtractionProviderError(
                "Gemini rejected the configured model request. Check GEMINI_MODEL and the structured-output configuration.",
                retryable=False,
            )
        if status_number == 404 or "not_found" in message:
            return ExtractionProviderError(
                "The configured Gemini model is unavailable to this project. Check GEMINI_MODEL and model access.",
                retryable=False,
            )
        return ExtractionProviderError(
            "The vision provider could not complete the request. Please try again.",
            retryable=True,
        )
