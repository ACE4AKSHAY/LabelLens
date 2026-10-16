from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    extract_mode: Literal["mock", "live"]
    gemini_api_key: str | None
    gemini_model: str
    max_image_bytes: int
    max_total_image_bytes: int


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

    max_total_image_bytes = _positive_int("MAX_TOTAL_IMAGE_BYTES", 14 * 1024 * 1024)
    if max_total_image_bytes > 14 * 1024 * 1024:
        raise ValueError("MAX_TOTAL_IMAGE_BYTES cannot exceed 14 MiB with inline Gemini requests")

    return Settings(
        extract_mode=mode,  # type: ignore[arg-type]
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip() or None,
        gemini_model=os.getenv("GEMINI_MODEL", "").strip() or "gemini-3.8-flash",
        max_image_bytes=_positive_int("MAX_IMAGE_BYTES", 10 * 1024 * 1024),
        max_total_image_bytes=max_total_image_bytes,
    )
