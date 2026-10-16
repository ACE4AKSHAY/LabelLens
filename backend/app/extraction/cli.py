from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path

from app.extraction.errors import ExtractionProviderError
from app.extraction.image_validation import SUPPORTED_IMAGE_TYPES, payload_matches_mime_type
from app.extraction.provider import Extractor, ImageInput, create_extractor
from app.extraction.settings import Settings, get_settings


def _make_extractor(settings: Settings) -> Extractor:
    return create_extractor(settings)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract evidence from a packaged-food label photo.")
    parser.add_argument("image", type=Path, help="Path to a JPEG, PNG, WebP, HEIC, or HEIF image")
    parser.add_argument("--out", type=Path, required=True, help="Path for the Extraction JSON output")
    args = parser.parse_args()

    try:
        settings = get_settings()
        data = args.image.read_bytes()
    except OSError as exc:
        print(f"Could not read image: {exc}", file=sys.stderr)
        return 2

    mime_type = mimetypes.guess_type(args.image.name)[0] or {".heic": "image/heic", ".heif": "image/heif"}.get(args.image.suffix.lower(), "")
    if mime_type not in SUPPORTED_IMAGE_TYPES or not payload_matches_mime_type(data, mime_type):
        print("Use a valid JPEG, PNG, WebP, HEIC, or HEIF image.", file=sys.stderr)
        return 2
    if len(data) > settings.max_image_bytes:
        print("The image exceeds MAX_IMAGE_BYTES.", file=sys.stderr)
        return 2

    try:
        extraction = _make_extractor(settings).extract([ImageInput(data=data, mime_type=mime_type)])
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(extraction.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except ExtractionProviderError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"Could not write output: {exc}", file=sys.stderr)
        return 2

    print(f"Extraction written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
