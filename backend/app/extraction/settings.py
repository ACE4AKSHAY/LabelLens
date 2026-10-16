from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
# .env wins over the process environment except EXTRACT_MODE, which launch
# scripts (run-live.bat) must be able to override; a machine-level
# GEMINI_API_KEY env var must not silently replace the key configured here.
_requested_extract_mode = os.getenv("EXTRACT_MODE")
load_dotenv(BACKEND_DIR / ".env", override=True)
if _requested_extract_mode:
    os.environ["EXTRACT_MODE"] = _requested_extract_mode


@dataclass(frozen=True)
class Settings:
    extract_mode: Literal["mock", "live"]
    gemini_api_key: str | None
    gemini_model: str
    max_image_bytes: int
    max_total_image_bytes: int
    vision_provider: Literal["gemini", "glm"] = "gemini"
    glm_api_key: str | None = None
    glm_model: str = "glm-5.3-flash"
    glm_api_url: str = "https://api.z.ai/api/paas/v4/chat/completions"
    gemini_fallback_model: str = "gemini-3.5-flash-lite"
    gemini_api_key_2: str | None = None


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive integer") from exc
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def get_settings() -> Settings:
    mode = os.getenv("EXTRACT_MODE", "mock").strip().lower()
    if mode not in {"mock", "live"}:
        raise ValueError("EXTRACT_MODE must be either 'mock' or 'live'")

    provider = os.getenv("VISION_PROVIDER", "gemini").strip().lower()
    if provider not in {"gemini", "glm"}:
        raise ValueError("VISION_PROVIDER must be either 'gemini' or 'glm'")

    max_total_image_bytes = _positive_int("MAX_TOTAL_IMAGE_BYTES", 14 * 1024 * 1024)
    if max_total_image_bytes > 14 * 1024 * 1024:
        raise ValueError("MAX_TOTAL_IMAGE_BYTES cannot exceed 14 MiB with inline Gemini requests")

    return Settings(
        extract_mode=mode,  # type: ignore[arg-type]
        vision_provider=provider,  # type: ignore[arg-type]
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip() or None,
        gemini_api_key_2=os.getenv("GEMINI_API_KEY_2", "").strip() or None,
        gemini_model=os.getenv("GEMINI_MODEL", "").strip() or "gemini-3.5-flash",
        glm_api_key=os.getenv("GLM_API_KEY", "").strip() or os.getenv("ZAI_API_KEY", "").strip() or None,
        glm_model=os.getenv("GLM_MODEL", "").strip() or "glm-5.3-flash",
        glm_api_url=os.getenv("GLM_API_URL", "").strip() or "https://api.z.ai/api/paas/v4/chat/completions",
        gemini_fallback_model=os.getenv("GEMINI_FALLBACK_MODEL", "").strip() or "gemini-3.5-flash-lite",
        max_image_bytes=_positive_int("MAX_IMAGE_BYTES", 10 * 1024 * 1024),
        max_total_image_bytes=max_total_image_bytes,
    )
