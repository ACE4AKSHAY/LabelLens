from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from app.extraction.errors import ExtractionProviderError
from app.extraction.evidence import validate_evidence
from app.extraction.provider import (
    GeminiExtractor,
    ImageInput,
    MockExtractor,
    ProviderFallbackExtractor,
    create_extractor,
)
from app.schemas import Extraction
from app.extraction.settings import Settings


def fixture_extraction() -> Extraction:
    root = Path(__file__).resolve().parents[2]
    payload = json.loads(
        (root / "shared" / "fixtures" / "extraction" / "clear_peanut_alias.json").read_text(
            encoding="utf-8"
        )
    )
    return Extraction.model_validate(payload)


class FakeExtractor:
    def __init__(self, result: Extraction | None = None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.calls = 0

    def extract(self, images: list[ImageInput]) -> Extraction:
        self.calls += 1
        if self.error:
            raise self.error
        assert self.result is not None
        return Extraction.model_validate(self.result.model_dump())


class ProviderFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.images = [ImageInput(data=b"test-image", mime_type="image/jpeg")]

    def test_primary_success_does_not_call_fallback(self) -> None:
        primary_result = fixture_extraction()
        primary = FakeExtractor(result=primary_result)
        fallback = FakeExtractor(result=fixture_extraction())

        result = ProviderFallbackExtractor(primary, fallback, "gemini", "glm").extract(self.images)

        self.assertEqual(result.analysis_id, primary_result.analysis_id)
        self.assertEqual(primary.calls, 1)
        self.assertEqual(fallback.calls, 0)

    def test_retryable_primary_error_uses_fallback_and_revalidates_evidence(self) -> None:
        primary = FakeExtractor(
            error=ExtractionProviderError("temporary 503", retryable=True, fallback_eligible=True)
        )
        fallback = FakeExtractor(result=fixture_extraction())

        with patch("app.extraction.provider.validate_evidence", wraps=validate_evidence) as validate:
            result = ProviderFallbackExtractor(primary, fallback, "gemini", "glm").extract(self.images)

        self.assertEqual(primary.calls, 1)
        self.assertEqual(fallback.calls, 1)
        validate.assert_called_once()
        self.assertEqual(validate.call_args.kwargs, {"require_each_image": True})
        self.assertEqual(len(result.images), 1)

    def test_credential_error_is_not_hidden_by_a_configured_fallback(self) -> None:
        credential_error = ExtractionProviderError(
            "invalid key", retryable=False, fallback_eligible=False
        )
        primary = FakeExtractor(error=credential_error)
        fallback = FakeExtractor(result=fixture_extraction())

        with self.assertRaises(ExtractionProviderError) as raised:
            ProviderFallbackExtractor(primary, fallback, "gemini", "glm").extract(self.images)

        self.assertIs(raised.exception, credential_error)
        self.assertEqual(fallback.calls, 0)

    def test_quota_uses_configured_secondary_and_preserves_quota_if_both_fail(self) -> None:
        quota_error = ExtractionProviderError(
            "primary quota", retryable=True, quota=True, fallback_eligible=True
        )
        primary = FakeExtractor(error=quota_error)
        fallback = FakeExtractor(
            error=ExtractionProviderError("secondary unavailable", retryable=True, fallback_eligible=True)
        )

        with self.assertRaises(ExtractionProviderError) as raised:
            ProviderFallbackExtractor(primary, fallback, "gemini", "glm").extract(self.images)

        self.assertEqual(fallback.calls, 1)
        self.assertTrue(raised.exception.quota)

    def test_quota_without_configured_secondary_preserves_original_error(self) -> None:
        quota_error = ExtractionProviderError(
            "primary quota", retryable=True, quota=True, fallback_eligible=True
        )
        primary = FakeExtractor(error=quota_error)

        with self.assertRaises(ExtractionProviderError) as raised:
            ProviderFallbackExtractor(primary, None, "gemini", "glm").extract(self.images)

        self.assertIs(raised.exception, quota_error)
        self.assertTrue(raised.exception.quota)

    def test_quota_fails_over_when_secondary_provider_is_configured(self) -> None:
        primary = FakeExtractor(
            error=ExtractionProviderError(
                "primary quota", retryable=True, quota=True, fallback_eligible=True
            )
        )
        fallback = FakeExtractor(result=fixture_extraction())

        result = ProviderFallbackExtractor(primary, fallback, "gemini", "glm").extract(self.images)

        self.assertEqual(fallback.calls, 1)
        self.assertEqual(len(result.images), 1)

    def test_mock_mode_remains_the_default_without_provider_keys(self) -> None:
        settings = Settings(
            extract_mode="mock",
            gemini_api_key=None,
            gemini_model="gemini-3.8-flash",
            max_image_bytes=1024,
            max_total_image_bytes=2048,
        )

        self.assertIsInstance(create_extractor(settings), MockExtractor)

    def test_gemini_without_other_keys_returns_bare_extractor(self) -> None:
        settings = Settings(
            extract_mode="live",
            gemini_api_key="configured-only-in-test",
            gemini_model="gemini-3.5-flash",
            max_image_bytes=1024,
            max_total_image_bytes=2048,
            vision_provider="gemini",
            glm_api_key=None,
        )

        chain = create_extractor(settings)

        self.assertIsInstance(chain, GeminiExtractor)
        with patch("app.extraction.provider.GLMExtractor") as glm_cls:
            create_extractor(settings)
            glm_cls.assert_not_called()

    def test_second_gemini_key_is_used_after_primary_quota(self) -> None:
        settings = Settings(
            extract_mode="live",
            gemini_api_key="key-one",
            gemini_api_key_2="key-two",
            gemini_model="gemini-3.5-flash",
            max_image_bytes=1024,
            max_total_image_bytes=2048,
            vision_provider="gemini",
            glm_api_key="glm-key",
        )
        constructor_keys: list[object] = []

        def make_gemini(settings: Settings, api_key: str | None = None) -> FakeExtractor:
            constructor_keys.append(api_key)
            if len(constructor_keys) == 1:
                return FakeExtractor(
                    error=ExtractionProviderError(
                        "primary quota", retryable=True, quota=True, fallback_eligible=True
                    )
                )
            return FakeExtractor(result=fixture_extraction())

        with (
            patch("app.extraction.provider.GeminiExtractor", side_effect=make_gemini),
            patch("app.extraction.provider.GLMExtractor") as glm_cls,
        ):
            chain = create_extractor(settings)
            result = chain.extract(self.images)

        self.assertEqual(constructor_keys, [None, "key-two"])
        glm_cls.return_value.extract.assert_not_called()
        self.assertEqual(len(result.images), 1)

    def test_glm_is_reached_after_both_gemini_keys_quota(self) -> None:
        settings = Settings(
            extract_mode="live",
            gemini_api_key="key-one",
            gemini_api_key_2="key-two",
            gemini_model="gemini-3.5-flash",
            max_image_bytes=1024,
            max_total_image_bytes=2048,
            vision_provider="gemini",
            glm_api_key="glm-key",
        )
        quota = ExtractionProviderError(
            "quota", retryable=True, quota=True, fallback_eligible=True
        )

        with (
            patch(
                "app.extraction.provider.GeminiExtractor",
                side_effect=lambda settings, api_key=None: FakeExtractor(error=quota),
            ) as gemini_cls,
            patch(
                "app.extraction.provider.GLMExtractor",
                side_effect=lambda settings: FakeExtractor(result=fixture_extraction()),
            ) as glm_cls,
        ):
            chain = create_extractor(settings)
            result = chain.extract(self.images)

        self.assertEqual(gemini_cls.call_count, 2)
        self.assertEqual(glm_cls.call_count, 1)
        self.assertEqual(len(result.images), 1)


if __name__ == "__main__":
    unittest.main()
