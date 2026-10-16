from __future__ import annotations

import re
from collections.abc import Iterable

from app.schemas import Extraction, ReviewablePhrase


def _normalized_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _append_review_reason(row: ReviewablePhrase, reason: str) -> None:
    row.review_required = True
    current = (row.review_reason or "").strip()
    if reason not in current:
        row.review_reason = f"{current}; {reason}" if current else reason


def _flag_quote(row: ReviewablePhrase, transcript: str | None) -> None:
    quote = _normalized_whitespace(row.evidence_quote)
    normalized_transcript = _normalized_whitespace(transcript or "")
    if not quote:
        _append_review_reason(row, "No evidence quote was supplied.")
    elif not normalized_transcript:
        _append_review_reason(row, "The source section transcript is unavailable.")
    elif quote not in normalized_transcript:
        _append_review_reason(row, "The evidence quote does not match the source transcript.")


def _all_text_rows(extraction: Extraction) -> Iterable[tuple[ReviewablePhrase, str | None]]:
    yield from ((row, extraction.sections.ingredients.text) for row in extraction.ingredients)
    yield from (
        (row, extraction.sections.allergen_statement.text)
        for row in (
            *extraction.allergen_statements.contains,
            *extraction.allergen_statements.may_contain,
            *extraction.allergen_statements.other,
        )
    )
    yield from ((row, extraction.sections.nutrition.text) for row in extraction.nutrition)
    yield from ((row, extraction.sections.product_details.text) for row in extraction.package_facts)


def _append_warning(extraction: Extraction, warning: str) -> None:
    if warning not in extraction.warnings:
        extraction.warnings.append(warning)


def validate_evidence(
    extraction: Extraction, image_count: int, *, require_each_image: bool = False
) -> Extraction:
    """Keep source text intact and force review when evidence cannot be confirmed."""
    sections = (
        extraction.sections.ingredients,
        extraction.sections.allergen_statement,
        extraction.sections.nutrition,
        extraction.sections.product_details,
    )
    for section in sections:
        if section.image_index is not None and not 0 <= section.image_index < image_count:
            section.image_index = None
            section.reason = (
                f"{section.reason}; source image reference did not match an uploaded image."
                if section.reason
                else "Source image reference did not match an uploaded image."
            )

    for row, transcript in _all_text_rows(extraction):
        _flag_quote(row, transcript)
        if row.image_index is None:
            _append_review_reason(row, "The source photo could not be linked.")
        elif not 0 <= row.image_index < image_count:
            row.image_index = None
            _append_review_reason(row, "The source image reference did not match an uploaded image.")

    for mark in extraction.marks:
        if mark.kind == "uncertain_diet_mark":
            mark.review_required = True
            if not mark.review_reason:
                mark.review_reason = "The visual mark could not be classified clearly."
        if not mark.visual_description.strip():
            mark.review_required = True
            if not mark.review_reason:
                mark.review_reason = "The visual description is missing."
        if not 0 <= mark.image_index < image_count:
            raise ValueError("A visual mark references an image that was not uploaded.")

    image_indices = {image.index for image in extraction.images}
    if any(index < 0 or index >= image_count for index in image_indices):
        raise ValueError("An image record references an image that was not uploaded.")
    if len(image_indices) != len(extraction.images):
        raise ValueError("Image indices must be unique.")
    if require_each_image and image_indices != set(range(image_count)):
        raise ValueError("Every uploaded image must have an image record.")

    for index, row in enumerate(extraction.ingredients, start=1):
        row.id = f"ing-{index}"
        if row.suggested_group and "unverified" not in row.suggested_group.note.casefold():
            row.suggested_group.note = f"Unverified model suggestion. {row.suggested_group.note}".strip()
    for index, row in enumerate(extraction.nutrition, start=1):
        row.id = f"nut-{index}"

    section_rows = (
        (extraction.sections.ingredients, extraction.ingredients, "ingredient rows"),
        (
            extraction.sections.allergen_statement,
            [
                *extraction.allergen_statements.contains,
                *extraction.allergen_statements.may_contain,
                *extraction.allergen_statements.other,
            ],
            "allergen phrases",
        ),
        (extraction.sections.nutrition, extraction.nutrition, "nutrition rows"),
        (extraction.sections.product_details, extraction.package_facts, "package facts"),
    )
    for section, rows, label in section_rows:
        if section.status == "readable_complete" and section.text and not rows and not section.reason:
            section.reason = f"No {label} were detected in the readable text."

    for attribute, fact_kind in (
        ("name", "product_name"),
        ("brand", "brand"),
        ("quantity", "quantity"),
    ):
        value = getattr(extraction.product, attribute)
        if not value:
            continue
        supporting_fact = next(
            (
                fact
                for fact in extraction.package_facts
                if fact.kind == fact_kind and fact.value_text == value
            ),
            None,
        )
        if supporting_fact is None or supporting_fact.review_required:
            setattr(extraction.product, attribute, None)
            _append_warning(
                extraction,
                f"The photo-read product {attribute} was omitted from the summary because its evidence needs review.",
            )

    return extraction
