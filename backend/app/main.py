from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.extraction.provider import (
    Extractor,
    create_extractor,
)
from app.extraction.settings import BACKEND_DIR, Settings, get_settings
from app.observability import request_id_context
from app.routes.extract import APIProblem, error_response, router
from app.schemas import HealthResponse


def _configure_logging() -> None:
    logger = logging.getLogger("labellens")
    if any(getattr(handler, "_labellens_handler", False) for handler in logger.handlers):
        return
    log_dir = BACKEND_DIR / "logs"
    log_dir.mkdir(exist_ok=True)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
    console = logging.StreamHandler()
    file_handler = RotatingFileHandler(
        log_dir / "labellens.log", maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    for handler in (console, file_handler):
        handler.setFormatter(formatter)
        handler._labellens_handler = True  # type: ignore[attr-defined]
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def make_extractor(settings: Settings) -> Extractor:
    return create_extractor(settings)


def create_app(settings: Settings | None = None, extractor: Extractor | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    _configure_logging()
    app = FastAPI(title="LabelLens API", version="1.0.0")
    app.state.extractor = extractor or make_extractor(resolved_settings)
    app.state.settings = resolved_settings

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        request_id = uuid4().hex[:12]
        token = request_id_context.set(request_id)
        started = monotonic()
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            logging.getLogger("labellens.http").info(
                "HTTP request_id=%s method=%s path=%s status=%s duration_ms=%d",
                request_id,
                request.method,
                request.url.path,
                response.status_code,
                int((monotonic() - started) * 1000),
            )
            return response
        except Exception:
            logging.getLogger("labellens.http").exception(
                "Unhandled HTTP failure request_id=%s method=%s path=%s",
                request_id,
                request.method,
                request.url.path,
            )
            raise
        finally:
            request_id_context.reset(token)

    @app.exception_handler(APIProblem)
    async def handle_api_problem(_: Request, problem: APIProblem) -> JSONResponse:
        return error_response(problem)

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(_: Request, __: RequestValidationError) -> JSONResponse:
        return error_response(
            APIProblem(400, "bad_input", "Provide 1–3 image files in the 'images' field.", False)
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_starlette_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code < 500:
            return error_response(
                APIProblem(400, "bad_input", "The multipart request could not be read.", False)
            )
        return error_response(
            APIProblem(502, "provider_error", "The backend could not complete the request.", True)
        )

    @app.get("/api/health", response_model=HealthResponse, tags=["health"])
    async def health() -> HealthResponse:
        return HealthResponse()

    app.include_router(router)
    return app


app = create_app()
