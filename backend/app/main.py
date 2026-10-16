from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.extraction.provider import Extractor, GeminiExtractor, GLMExtractor, MockExtractor
from app.extraction.settings import Settings, get_settings
from app.routes.extract import APIProblem, error_response, router
from app.schemas import HealthResponse


def make_extractor(settings: Settings) -> Extractor:
    if settings.extract_mode == "mock":
        return MockExtractor()
    if settings.vision_provider == "glm":
        return GLMExtractor(settings)
    return GeminiExtractor(settings)


def create_app(settings: Settings | None = None, extractor: Extractor | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(title="LabelLens API", version="1.0.0")
    app.state.extractor = extractor or make_extractor(resolved_settings)
    app.state.settings = resolved_settings

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
