from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


SectionStatus = Literal[
    "readable_complete",
    "readable_partial",
    "unreadable",
    "not_uploaded",
    "ambiguous",
]
ImageQuality = Literal["good", "blurry", "cropped", "glare", "unusable"]
ImageRole = Literal["ingredients", "allergens", "nutrition", "front", "other", "unknown"]


class SectionReading(ContractModel):
    status: SectionStatus
    text: str | None
    image_index: int | None
    reason: str | None


class SourcePhrase(ContractModel):
    label_text: str
    evidence_quote: str
    image_index: int | None


class ReviewablePhrase(SourcePhrase):
    review_required: bool
    review_reason: str | None


class SuggestedGroup(ContractModel):
    group: str
    note: str


class IngredientRow(ReviewablePhrase):
    id: str
    edited_by_user: bool | None = None
    suggested_group: SuggestedGroup | None = None


class Mark(ContractModel):
    kind: Literal["veg_mark", "nonveg_mark", "uncertain_diet_mark"]
    visual_description: str
    image_index: int
    review_required: bool
    review_reason: str | None


class PackageFact(ReviewablePhrase):
    kind: Literal[
        "product_name",
        "brand",
        "quantity",
        "manufacture_date",
        "best_before",
        "expiry_date",
        "batch_code",
    ]
    value_text: str


class NutritionRow(ReviewablePhrase):
    id: str
    nutrient: str | None
    amount_text: str | None
    unit: str | None
    basis: str | None


class ImageReading(ContractModel):
    index: int
    role: ImageRole
    quality: ImageQuality
    note: str | None


class ProductSummary(ContractModel):
    name: str | None
    brand: str | None
    quantity: str | None


class AllergenStatements(ContractModel):
    contains: list[ReviewablePhrase]
    may_contain: list[ReviewablePhrase]
    other: list[ReviewablePhrase]


class ExtractionSections(ContractModel):
    ingredients: SectionReading
    allergen_statement: SectionReading
    nutrition: SectionReading
    product_details: SectionReading


class Extraction(ContractModel):
    schema_version: Literal["1"]
    analysis_id: str
    images: list[ImageReading]
    product: ProductSummary
    package_facts: list[PackageFact]
    sections: ExtractionSections
    ingredients: list[IngredientRow]
    allergen_statements: AllergenStatements
    marks: list[Mark]
    nutrition: list[NutritionRow]
    warnings: list[str]


ApiErrorCode = Literal["bad_input", "quota", "provider_error", "unreadable_response"]


class ApiError(ContractModel):
    code: ApiErrorCode
    message: str
    retryable: bool


class ApiErrorEnvelope(ContractModel):
    error: ApiError


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"