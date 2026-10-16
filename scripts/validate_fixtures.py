"""Validate every extraction fixture against the frozen Pydantic contract.

Usage (from the repository root):
    python scripts/validate_fixtures.py

Requires Python 3.12+ with backend/requirements.txt installed.
The authoritative schema check; scripts/check_rules.mjs only mirrors it
structurally so the rules check can also run without Python.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.schemas import Extraction  # noqa: E402


def main() -> int:
    fixtures_dir = ROOT / "shared" / "fixtures" / "extraction"
    fixtures = sorted(fixtures_dir.glob("*.json"))
    if not fixtures:
        print(f"No fixtures found in {fixtures_dir}")
        return 1
    failures = 0
    for path in fixtures:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            Extraction.model_validate(data)
            print(f"PASS {path.name}")
        except Exception as exc:  # JSON or pydantic.ValidationError
            failures += 1
            first_line = str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__
            print(f"FAIL {path.name}: {first_line}")
    print(f"{len(fixtures) - failures}/{len(fixtures)} fixtures valid against the Pydantic contract")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
