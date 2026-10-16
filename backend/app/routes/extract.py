from __future__ import annotations

import logging
from time import monotonic
from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.extraction.errors import ExtractionProviderError, UnreadableResponseError
from app.extraction.image_validation import SUPPORTED_IMAGE_TYPES, payload_matches_mime_type
from app.extraction.provider import Extractor, ImageInput
from app.extraction.settings import Settings
from app.schemas import ApiErrorEnvelope, Extraction
from app.observability import request_id_context


@dataclass
class APIProblem(Exception):
    status_code: int
    code: str
    message: str
    retryable: bool = False


def error_response(problem: APIProblem) -> JSONResponse:
    body = {
        "error": {
            "code": problem.code,
            "message": problem.message,
            "retryable": problem.retryable,
        }
    }
    return JSONResponse(status_code=problem.status_code, content=body)


router = APIRouter(prefix="/api", tags=["extraction"])


@router.post(
    "/extract",
    response_model=Extraction,
    responses={
        400: {"model": ApiErrorEnvelope},
        413: {"model": ApiErrorEnvelope},
        415: {"model": ApiErrorEnvelope},
        429: {"model": ApiErrorEnvelope},
        502: {"model": ApiErrorEnvelope},
        503: {"model": ApiErrorEnvelope},
    },
)
async def extract_label(
    request: Request,
    images: Annotated[list[UploadFile], File(description="1–3 label photos under the repeated field name 'images'")],
) -> Extraction:
    form = await request.form()
    unexpected_fields = set(form.keys()) - {"images"}
    if unexpected_fields:
        raise APIProblem(
            400,
            "bad_input",
            "Only image files are accepted. Dietary profiles must stay in the browser.",
        )
    if not 1 <= len(images) <= 3:
        raise APIProblem(400, "bad_input", "Upload between 1 and 3 label photos.")

    settings: Settings = request.app.state.settings
    image_inputs: list[ImageInput] = []
    total_size = 0
    for upload in images:
        mime_type = upload.content_type or ""
        if mime_type not in SUPPORTED_IMAGE_TYPES:
            raise APIProblem(
                415,
                "bad_input",
                "Use a JPEG, PNG, WebP, HEIC, or HEIF image.",
            )
        data = await upload.read(settings.max_image_bytes + 1)
        if len(data) > settings.max_image_bytes:
            raise APIProblem(413, "bad_input", "Each image exceeds the configured size limit.")
        total_size += len(data)
        if total_size > settings.max_total_image_bytes:
            raise APIProblem(413, "bad_input", "The combined image size exceeds the configured limit.")
        if not data or not payload_matches_mime_type(data, mime_type):
            raise APIProblem(400, "bad_input", "The uploaded file is not a valid image of its declared type.")
        image_inputs.append(ImageInput(data=data, mime_type=mime_type))

    extractor: Extractor = request.app.state.extractor
    started = monotonic()
    request_id = request_id_context.get()
    settings: Settings = request.app.state.settings
    logging.getLogger("labellens.extract").info(
        "Extraction started request_id=%s provider=%s image_count=%d",
        request_id,
        settings.vision_provider,
        len(image_inputs),
    )
    try:
        extraction = await run_in_threadpool(extractor.extract, image_inputs)
        logging.getLogger("labellens.extract").info(
            "Extraction completed request_id=%s provider=%s duration_ms=%d ingredient_rows=%d allergen_rows=%d",
            request_id,
            settings.vision_provider,
            int((monotonic() - started) * 1000),
            len(extraction.ingredients),
            len(extraction.allergen_statements.contains)
            + len(extraction.allergen_statements.may_contain)
            + len(extraction.allergen_statements.other),
        )
        return extraction
    except UnreadableResponseError as exc:
        logging.getLogger("labellens.extract").error(
            "Extraction output could not be validated request_id=%s provider=%s duration_ms=%d",
            request_id,
            settings.vision_provider,
            int((monotonic() - started) * 1000),
        )
        raise APIProblem(502, "unreadable_response", str(exc), exc.retryable) from None
    except ExtractionProviderError as exc:
        logging.getLogger("labellens.extract").error(
            "Extraction provider failed request_id=%s provider=%s duration_ms=%d retryable=%s quota=%s error=%s",
            request_id,
            settings.vision_provider,
            int((monotonic() - started) * 1000),
            exc.retryable,
            exc.quota,
            str(exc),
        )
        code = "quota" if exc.quota else "provider_error"
        status_code = 429 if exc.quota else (503 if not exc.retryable else 502)
        raise APIProblem(status_code, code, str(exc), exc.retryable) from None
    except Exception:
        logging.getLogger("labellens.extract").exception(
            "Unhandled extraction failure request_id=%s provider=%s",
            request_id,
            settings.vision_provider,
        )
        raise APIProblem(
            502,
            "provider_error",
            "The extraction provider could not complete the request.",
            True,
        ) from None
