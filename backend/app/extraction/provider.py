from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
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


def _gemini_response_schema() -> dict[str, Any]:
    """Convert Pydantic's JSON Schema to Gemini's supported subset."""
    schema = Extraction.model_json_schema()

    def normalize(value: Any) -> Any:
        if isinstance(value, dict):
            if "const" in value:
                value["enum"] = [value.pop("const")]
            value.pop("default", None)
            for key, child in tuple(value.items()):
                value[key] = normalize(child)
        elif isinstance(value, list):
            return [normalize(item) for item in value]
        return value

    return normalize(schema)


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
            with genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=90_000),
            ) as client:
                for attempt in range(2):
                    contents = base_contents if attempt == 0 else [*base_contents, RETRY_INSTRUCTION]
                    try:
                        response = client.models.generate_content(
                            model=self.settings.gemini_model,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                system_instruction=SYSTEM_INSTRUCTION,
                                response_mime_type="application/json",
                                response_json_schema=_gemini_response_schema(),
                                thinking_config=types.ThinkingConfig(thinking_level="low"),
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

        logging.getLogger(__name__).warning(
            "Gemini request failed: exception=%s status=%s",
            type(exc).__name__,
            status_number,
        )

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


class GLMExtractor:
    """Z.AI GLM-5.3-Flash adapter; validate schema-guided JSON against our contract locally."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def extract(self, images: Sequence[ImageInput]) -> Extraction:
        if not self.settings.glm_api_key:
            raise ExtractionProviderError(
                "Live extraction is not configured. Set GLM_API_KEY in backend/.env.",
                retryable=False,
            )
        if not images:
            raise ValueError("At least one image is required.")

        schema_text = json.dumps(Extraction.model_json_schema(), ensure_ascii=False)
        system_prompt = (
            SYSTEM_INSTRUCTION
            + "\nReturn exactly one JSON object, with no markdown or extra prose, matching this JSON Schema: "
            + schema_text
        )
        message_content: list[dict[str, Any]] = [
            {"type": "text", "text": "Read these package label image(s). Keep image indexes in upload order, starting at zero."}
        ]
        for image in images:
            data_uri = f"data:{image.mime_type};base64,{base64.b64encode(image.data).decode('ascii')}"
            message_content.append({"type": "image_url", "image_url": {"url": data_uri}})

        for attempt in range(2):
            if attempt:
                message_content[0]["text"] += (
                    " Your previous response did not validate. Return a complete JSON object only; "
                    "preserve exact label text and do not fill unreadable or missing information."
                )
            payload = {
                "model": self.settings.glm_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message_content},
                ],
                "temperature": 0.1,
                "reasoning_effort": "low",
                "max_tokens": 16000,
                "stream": False,
            }
            try:
                response_data = self._request(payload)
            except _GLMHTTPError as exc:
                raise self._provider_error(exc) from None
            except (URLError, TimeoutError, OSError):
                raise ExtractionProviderError(
                    "GLM could not be reached. Check the network and try again.", retryable=True
                ) from None
            except json.JSONDecodeError:
                if attempt:
                    raise UnreadableResponseError() from None
                continue

            try:
                content = response_data["choices"][0]["message"]["content"]
                if not isinstance(content, str) or not content.strip():
                    raise ValueError("empty response")
                raw_text = content.strip()
                if raw_text.startswith("```json") and raw_text.endswith("```"):
                    raw_text = raw_text[7:-3].strip()
                elif raw_text.startswith("```") and raw_text.endswith("```"):
                    raw_text = raw_text[3:-3].strip()
                extraction = Extraction.model_validate_json(raw_text)
                data = extraction.model_dump()
                data["analysis_id"] = uuid4().hex
                extraction = Extraction.model_validate(data)
                return validate_evidence(extraction, len(images), require_each_image=True)
            except (KeyError, IndexError, TypeError, ValidationError, ValueError):
                if attempt:
                    raise UnreadableResponseError() from None

        raise UnreadableResponseError()

    def _request(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = Request(
            self.settings.glm_api_url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.settings.glm_api_key}",
                "Content-Type": "application/json",
                "Accept-Language": "en-US,en",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=180) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
                error_detail = error_body.get("error", error_body)
                code = error_detail.get("code")
                message = str(error_detail.get("message", ""))
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
                code, message = None, ""
            raise _GLMHTTPError(exc.code, code, message) from None
        if not isinstance(body, dict):
            raise UnreadableResponseError()
        return body

    @staticmethod
    def _provider_error(exc: _GLMHTTPError) -> ExtractionProviderError:
        message = exc.message.lower()
        account_errors = {
            "1113": "GLM API balance is empty or no API resource package is available. Add API credit in the Z.AI console before retrying.",
            "1309": "The GLM subscription has expired. Check the Z.AI account and general API access before retrying.",
            "1311": "This GLM account does not have access to the configured model. Check GLM_MODEL and model access in Z.AI.",
            "1314": "The GLM enterprise package has expired. Contact the account administrator.",
            "1315": "This GLM key is restricted to coding tools. Configure a general API key with vision access for LabelLens.",
        }
        if str(exc.code) in account_errors:
            return ExtractionProviderError(account_errors[str(exc.code)], retryable=False)
        if exc.status == 429 or str(exc.code) in {"1302", "1303"} or "quota" in message:
            return ExtractionProviderError(
                "GLM quota or rate limit is temporarily exhausted. Please try again later.",
                retryable=True,
                quota=True,
            )
        if exc.status in {401, 403}:
            return ExtractionProviderError(
                "GLM rejected the backend credential or project access. Check GLM_API_KEY in backend/.env.",
                retryable=False,
            )
        if exc.status == 400:
            return ExtractionProviderError(
                "GLM rejected the request. Check GLM_MODEL and the provider account's vision access.",
                retryable=False,
            )
        if exc.status == 404:
            return ExtractionProviderError(
                "The configured GLM model or API endpoint is unavailable. Check GLM_MODEL and GLM_API_URL.",
                retryable=False,
            )
        return ExtractionProviderError(
            "GLM could not complete the extraction request. Please try again.", retryable=True
        )


class _GLMHTTPError(Exception):
    def __init__(self, status: int, code: object, message: str) -> None:
        self.status = status
        self.code = code
        self.message = message
