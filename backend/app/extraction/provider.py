from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from time import monotonic
from typing import Any, Protocol, Sequence
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from pydantic import ValidationError

from app.extraction.errors import ExtractionProviderError, UnreadableResponseError
from app.extraction.evidence import validate_evidence
from app.extraction.settings import PROJECT_DIR, Settings
from app.observability import request_id_context
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

        models = [self.settings.gemini_model]
        fallback_model = self.settings.gemini_fallback_model.strip()
        if fallback_model and fallback_model not in models:
            models.append(fallback_model)

        request_id = request_id_context.get()
        model_errors: list[tuple[str, ExtractionProviderError]] = []
        try:
            with genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=90_000),
            ) as client:
                for model_index, model in enumerate(models):
                    try:
                        extraction = self._extract_with_model(client, types, model, base_contents, len(images))
                        logging.getLogger("labellens.provider").info(
                            "Vision extraction succeeded request_id=%s provider=gemini model=%s model_fallback=%s",
                            request_id,
                            model,
                            model_index > 0,
                        )
                        return extraction
                    except ExtractionProviderError as exc:
                        model_errors.append((model, exc))
                        has_fallback = model_index + 1 < len(models)
                        logging.getLogger("labellens.provider").warning(
                            "Vision model failed request_id=%s provider=gemini model=%s fallback_eligible=%s error=%s",
                            request_id,
                            model,
                            exc.fallback_eligible,
                            str(exc),
                        )
                        if has_fallback and exc.fallback_eligible:
                            logging.getLogger("labellens.provider").warning(
                                "Trying Gemini fallback request_id=%s primary_model=%s fallback_model=%s",
                                request_id,
                                model,
                                models[model_index + 1],
                            )
                            continue
                        if model_index > 0 and model_errors:
                            primary_model, primary_error = model_errors[0]
                            raise ExtractionProviderError(
                                f"Gemini primary model {primary_model} failed: {primary_error} Fallback model {model} also failed: {exc}",
                                retryable=exc.retryable,
                                quota=exc.quota,
                            ) from None
                        raise
        except ExtractionProviderError:
            raise
        except Exception as exc:
            raise self._provider_error(exc) from None

        raise UnreadableResponseError()

    def _extract_with_model(
        self,
        client: Any,
        types: Any,
        model: str,
        base_contents: list[object],
        image_count: int,
    ) -> Extraction:
        for attempt in range(2):
            contents = base_contents if attempt == 0 else [*base_contents, RETRY_INSTRUCTION]
            started = monotonic()
            logging.getLogger("labellens.provider").info(
                "Vision model attempt started request_id=%s provider=gemini model=%s attempt=%d",
                request_id_context.get(),
                model,
                attempt + 1,
            )
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_json_schema=_gemini_response_schema(),
                        temperature=0,
                        max_output_tokens=16_000,
                    ),
                )
            except Exception as exc:
                logging.getLogger("labellens.provider").warning(
                    "Vision model attempt failed request_id=%s provider=gemini model=%s attempt=%d duration_ms=%d",
                    request_id_context.get(),
                    model,
                    attempt + 1,
                    int((monotonic() - started) * 1000),
                )
                raise self._provider_error(exc) from None

            raw_text = getattr(response, "text", None)
            if not isinstance(raw_text, str) or not raw_text.strip():
                logging.getLogger("labellens.provider").warning(
                    "Vision model returned an empty response request_id=%s provider=gemini model=%s attempt=%d duration_ms=%d",
                    request_id_context.get(),
                    model,
                    attempt + 1,
                    int((monotonic() - started) * 1000),
                )
                if attempt == 0:
                    continue
                raise UnreadableResponseError()

            try:
                extraction = Extraction.model_validate_json(raw_text)
                data = extraction.model_dump()
                data["analysis_id"] = uuid4().hex
                extraction = Extraction.model_validate(data)
                return validate_evidence(extraction, image_count, require_each_image=True)
            except (ValidationError, ValueError, TypeError) as exc:
                logging.getLogger("labellens.provider").warning(
                    "Vision response did not validate request_id=%s provider=gemini model=%s attempt=%d validation_error=%s",
                    request_id_context.get(),
                    model,
                    attempt + 1,
                    type(exc).__name__,
                )
                if attempt == 0:
                    continue
                raise UnreadableResponseError() from None
        raise UnreadableResponseError()

    @staticmethod
    def _provider_error(exc: Exception) -> ExtractionProviderError:
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        message = str(exc).lower()
        try:
            status_number = int(status)
        except (TypeError, ValueError):
            status_number = None

        logging.getLogger("labellens.provider").warning(
            "Vision API request failed request_id=%s provider=gemini exception=%s status=%s",
            request_id_context.get(),
            type(exc).__name__,
            status_number,
        )

        if status_number == 429 or "resource_exhausted" in message or "quota" in message:
            return ExtractionProviderError(
                "Gemini rejected this request because the project reached a quota or rate limit. Check the project's Gemini API limits, then try again.",
                retryable=True,
                quota=True,
                fallback_eligible=True,
            )
        invalid_key = "api key not valid" in message or "invalid api key" in message
        if invalid_key or status_number in {401, 403} or "permission_denied" in message or "unauthenticated" in message:
            return ExtractionProviderError(
                "Gemini rejected the backend credential or project access. Check GEMINI_API_KEY in backend/.env.",
                retryable=False,
                fallback_eligible=False,
            )
        if status_number == 400:
            return ExtractionProviderError(
                "Gemini rejected the configured model request. Check GEMINI_MODEL and the structured-output configuration.",
                retryable=False,
                fallback_eligible=True,
            )
        if status_number == 404 or "not_found" in message:
            return ExtractionProviderError(
                "The configured Gemini model is unavailable to this project. Check GEMINI_MODEL and model access.",
                retryable=False,
                fallback_eligible=True,
            )
        if status_number == 504 or "timeout" in message or "timed out" in message:
            return ExtractionProviderError(
                "Gemini returned HTTP 504 and timed out. Try again; smaller photos may reduce processing time.",
                retryable=True,
                fallback_eligible=True,
            )
        if status_number == 503:
            return ExtractionProviderError(
                "Gemini returned HTTP 503 and is temporarily unavailable. Please retry the scan shortly.",
                retryable=True,
                fallback_eligible=True,
            )
        if (status_number is not None and status_number >= 500) or "unavailable" in message or "internal" in message:
            return ExtractionProviderError(
                f"Gemini returned a temporary server error (HTTP {status_number or 'unknown'}). Please retry the scan.",
                retryable=True,
                fallback_eligible=True,
            )
        return ExtractionProviderError(
            "Gemini could not complete the image request. Check backend/logs/labellens.log for the request details, then retry.",
            retryable=True,
            fallback_eligible=True,
        )


class ProviderFallbackExtractor:
    """Try the configured provider, then Gemini when that provider cannot extract."""

    def __init__(self, primary: Extractor, fallback: Extractor, primary_name: str) -> None:
        self.primary = primary
        self.fallback = fallback
        self.primary_name = primary_name

    def extract(self, images: Sequence[ImageInput]) -> Extraction:
        try:
            return self.primary.extract(images)
        except ExtractionProviderError as primary_error:
            if not primary_error.fallback_eligible:
                raise
            logger = logging.getLogger("labellens.provider")
            logger.warning(
                "Vision provider failed; trying Gemini fallback request_id=%s provider=%s error=%s",
                request_id_context.get(),
                self.primary_name,
                str(primary_error),
            )
            try:
                extraction = self.fallback.extract(images)
                logger.info(
                    "Vision fallback succeeded request_id=%s provider=%s fallback=gemini",
                    request_id_context.get(),
                    self.primary_name,
                )
                return extraction
            except ExtractionProviderError as fallback_error:
                logger.error(
                    "Vision fallback failed request_id=%s provider=%s fallback=gemini primary_error=%s fallback_error=%s",
                    request_id_context.get(),
                    self.primary_name,
                    str(primary_error),
                    str(fallback_error),
                )
                raise ExtractionProviderError(
                    f"{self.primary_name.upper()} failed: {primary_error} Gemini fallback also failed: {fallback_error}. See backend/logs/labellens.log; request ID {request_id_context.get()}.",
                    retryable=fallback_error.retryable,
                    quota=fallback_error.quota,
                ) from None


class GLMExtractor:
    """Z.AI GLM-5.3-Flash adapter; validate schema-guided JSON against our contract locally."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def extract(self, images: Sequence[ImageInput]) -> Extraction:
        if not self.settings.glm_api_key:
            raise ExtractionProviderError(
                "Live extraction is not configured. Set GLM_API_KEY in backend/.env.",
                retryable=False,
                fallback_eligible=True,
            )
        if not images:
            raise ValueError("At least one image is required.")

        glm_url = urlparse(self.settings.glm_api_url)
        if "/api/anthropic" in glm_url.path:
            raise ExtractionProviderError(
                "This Z.AI URL uses the Anthropic Messages protocol, while LabelLens's GLM adapter uses OpenAI-compatible Chat Completions. The GLM Coding Plan is limited to Z.AI-supported tools and cannot be used by LabelLens. Select Gemini, or use a separate general Z.AI API key with https://api.z.ai/api/paas/v4/chat/completions.",
                retryable=False,
                fallback_eligible=True,
            )
        if "/api/coding/paas/" in glm_url.path:
            raise ExtractionProviderError(
                "This is Z.AI's Coding Plan endpoint. Its subscription is restricted to officially supported tools and cannot be used by LabelLens. Select Gemini, or use a separate general Z.AI API key with https://api.z.ai/api/paas/v4/chat/completions.",
                retryable=False,
                fallback_eligible=True,
            )

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
            started = monotonic()
            logging.getLogger("labellens.provider").info(
                "Vision model attempt started request_id=%s provider=glm model=%s attempt=%d",
                request_id_context.get(),
                self.settings.glm_model,
                attempt + 1,
            )
            try:
                response_data = self._request(payload)
            except _GLMHTTPError as exc:
                logging.getLogger("labellens.provider").warning(
                    "Vision model attempt failed request_id=%s provider=glm model=%s attempt=%d duration_ms=%d",
                    request_id_context.get(),
                    self.settings.glm_model,
                    attempt + 1,
                    int((monotonic() - started) * 1000),
                )
                raise self._provider_error(exc) from None
            except (URLError, TimeoutError, OSError, UnicodeDecodeError):
                logging.getLogger("labellens.provider").warning(
                    "Vision API request failed request_id=%s provider=glm model=%s category=network duration_ms=%d",
                    request_id_context.get(),
                    self.settings.glm_model,
                    int((monotonic() - started) * 1000),
                )
                raise ExtractionProviderError(
                    "GLM could not be reached or returned an invalid response encoding. Check the network and try again.",
                    retryable=True,
                    fallback_eligible=True,
                ) from None
            except json.JSONDecodeError:
                logging.getLogger("labellens.provider").warning(
                    "Vision API response was not JSON request_id=%s provider=glm model=%s attempt=%d duration_ms=%d",
                    request_id_context.get(),
                    self.settings.glm_model,
                    attempt + 1,
                    int((monotonic() - started) * 1000),
                )
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
                extraction = validate_evidence(extraction, len(images), require_each_image=True)
                logging.getLogger("labellens.provider").info(
                    "Vision extraction succeeded request_id=%s provider=glm model=%s fallback=false",
                    request_id_context.get(),
                    self.settings.glm_model,
                )
                return extraction
            except (KeyError, IndexError, TypeError, ValidationError, ValueError):
                logging.getLogger("labellens.provider").warning(
                    "Vision response did not validate request_id=%s provider=glm model=%s attempt=%d",
                    request_id_context.get(),
                    self.settings.glm_model,
                    attempt + 1,
                )
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
        logging.getLogger("labellens.provider").warning(
            "Vision API request failed request_id=%s provider=glm status=%d provider_code=%s",
            request_id_context.get(),
            exc.status,
            exc.code,
        )
        account_errors = {
            "1113": "GLM API balance is empty or no API resource package is available. Add API credit in the Z.AI console before retrying.",
            "1309": "The GLM subscription has expired. Check the Z.AI account and general API access before retrying.",
            "1311": "This GLM account does not have access to the configured model. Check GLM_MODEL and model access in Z.AI.",
            "1314": "The GLM enterprise package has expired. Contact the account administrator.",
            "1315": "This GLM key is restricted to coding tools. Configure a general API key with vision access for LabelLens.",
        }
        if str(exc.code) in account_errors:
            return ExtractionProviderError(
                account_errors[str(exc.code)], retryable=False, fallback_eligible=True
            )
        if exc.status == 429 or str(exc.code) in {"1302", "1303"} or "quota" in message:
            return ExtractionProviderError(
                "GLM quota or rate limit is temporarily exhausted. Please try again later.",
                retryable=True,
                quota=True,
                fallback_eligible=True,
            )
        if exc.status in {401, 403}:
            return ExtractionProviderError(
                "GLM rejected the backend credential or project access. Check GLM_API_KEY in backend/.env.",
                retryable=False,
                fallback_eligible=True,
            )
        if exc.status == 400:
            return ExtractionProviderError(
                "GLM rejected the request. Check GLM_MODEL and the provider account's vision access.",
                retryable=False,
                fallback_eligible=True,
            )
        if exc.status == 404:
            return ExtractionProviderError(
                "The configured GLM model or API endpoint is unavailable. Check GLM_MODEL and GLM_API_URL.",
                retryable=False,
                fallback_eligible=True,
            )
        return ExtractionProviderError(
            "GLM could not complete the extraction request. Please try again.",
            retryable=True,
            fallback_eligible=True,
        )


class _GLMHTTPError(Exception):
    def __init__(self, status: int, code: object, message: str) -> None:
        self.status = status
        self.code = code
        self.message = message
