// Flat, Excel-friendly export of the current scan. Source quotes and user
// corrections stay in separate columns; section rows keep missing data explicit.

import type {
  ConfirmState,
  EvidenceItem,
  Extraction,
  ProfileResult,
  Results,
  ReviewablePhrase,
} from "@shared/contracts";
import {
  allergenCorrectionId,
  applyCorrections,
} from "./applyCorrections";

const COLUMNS = [
  "record_type",
  "field",
  "category",
  "current_value",
  "original_extracted_value",
  "evidence_quote",
  "visual_description",
  "image_index",
  "section_status",
  "information_status",
  "review_required",
  "review_reason",
  "section_text",
  "comparison_target",
  "comparison_status",
  "comparison_rule",
  "comparison_reason",
  "evidence_match",
  "mapped_to",
  "image_quality",
  "image_role",
  "image_note",
  "user_confirmation",
] as const;

type Column = (typeof COLUMNS)[number];
type CsvRow = Partial<Record<Column, string | number | boolean | null>>;

/** Quote CSV cells and prefix formula-like text so Excel opens it as text. */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function buildScanCsv({
  extraction,
  results,
  confirm,
  corrections,
  rowChecked,
  rowRestored,
}: {
  extraction: Extraction;
  results: Results;
  confirm: ConfirmState;
  corrections: Record<string, string>;
  rowChecked: Record<string, boolean>;
  rowRestored: Record<string, boolean>;
}): string {
  const effective = applyCorrections(extraction, corrections, rowChecked, rowRestored);
  const rows: CsvRow[] = [];
  const add = (entry: CsvRow) => rows.push(entry);

  add({ record_type: "scan", field: "analysis_id", current_value: extraction.analysis_id });

  const sections = [
    ["ingredients", "Ingredients", extraction.sections.ingredients, extraction.ingredients.length],
    ["allergen_statement", "Allergen statement", extraction.sections.allergen_statement,
      extraction.allergen_statements.contains.length + extraction.allergen_statements.may_contain.length + extraction.allergen_statements.other.length],
    ["nutrition", "Nutrition", extraction.sections.nutrition, extraction.nutrition.length],
    ["product_details", "Product details", extraction.sections.product_details,
      extraction.package_facts.length + Number(extraction.product.name !== null) + Number(extraction.product.brand !== null) + Number(extraction.product.quantity !== null)],
  ] as const;
  for (const [key, label, section, count] of sections) {
    add({
      record_type: "section",
      field: label,
      category: key,
      section_status: section.status,
      information_status: count === 0
        ? "No rows extracted; absence is not confirmed"
        : section.status === "readable_complete" ? "readable complete" : "incomplete or uncertain",
      review_reason: section.reason,
      section_text: section.text,
      image_index: section.image_index,
    });
  }

  for (const [field, value] of [
    ["ingredients_complete", confirm.ingredients_complete],
    ["allergen_statement_complete", confirm.allergen_statement_complete],
    ["pack_has_no_allergen_statement", confirm.pack_has_no_allergen_statement],
  ] as const) {
    add({
      record_type: "user_confirmation",
      field,
      current_value: value ? "confirmed by user" : "not confirmed",
      user_confirmation: value ? "yes" : "no",
    });
  }

  for (const reading of extraction.images) {
    add({
      record_type: "photo_reading",
      field: `Photo ${reading.index + 1}`,
      image_index: reading.index,
      image_quality: reading.quality,
      image_role: reading.role,
      image_note: reading.note,
      information_status: "automated estimate; not a calibrated quality measurement",
    });
  }

  for (const field of ["name", "brand", "quantity"] as const) {
    const value = extraction.product[field];
    if (value !== null) {
      add({ record_type: "product", field, category: "product summary", current_value: value });
    }
  }

  const addPhrase = (
    category: string,
    original: ReviewablePhrase,
    current: ReviewablePhrase,
    id: string,
    field: string,
  ) => {
    const edited = corrections[id] !== undefined && corrections[id] !== original.label_text;
    const checked = rowChecked[id] === true;
    const state = [
      edited ? "user-corrected" : "",
      checked ? "user-confirmed against photo" : "",
      current.review_required ? "unresolved" : "",
    ].filter(Boolean).join("; ") || "as read";
    add({
      record_type: "extracted_value",
      field,
      category,
      current_value: current.label_text,
      original_extracted_value: original.label_text,
      evidence_quote: original.evidence_quote,
      image_index: original.image_index,
      information_status: state,
      review_required: current.review_required,
      review_reason: original.review_reason ?? current.review_reason,
      user_confirmation: checked ? "confirmed against photo" : "not confirmed",
    });
  };

  for (const [index, original] of extraction.ingredients.entries()) {
    addPhrase("ingredient", original, effective.ingredients[index], original.id, original.id);
  }
  for (const bucket of ["contains", "may_contain", "other"] as const) {
    extraction.allergen_statements[bucket].forEach((original, index) => {
      const id = allergenCorrectionId(bucket, index);
      addPhrase(`allergen statement: ${bucket}`, original, effective.allergen_statements[bucket][index], id, id);
    });
  }

  for (const fact of extraction.package_facts) {
    add({
      record_type: "extracted_value",
      field: fact.kind,
      category: "package fact",
      current_value: fact.value_text,
      original_extracted_value: fact.label_text,
      evidence_quote: fact.evidence_quote,
      image_index: fact.image_index,
      information_status: fact.review_required ? "unresolved" : "as read",
      review_required: fact.review_required,
      review_reason: fact.review_reason,
    });
  }

  for (const nutrient of extraction.nutrition) {
    add({
      record_type: "extracted_value",
      field: nutrient.nutrient ?? "nutrition value",
      category: "nutrition",
      current_value: [nutrient.amount_text, nutrient.unit, nutrient.basis].filter(Boolean).join(" "),
      original_extracted_value: nutrient.label_text,
      evidence_quote: nutrient.evidence_quote,
      image_index: nutrient.image_index,
      information_status: nutrient.review_required
        ? "unresolved"
        : nutrient.amount_text === null ? "value unreadable" : "as read",
      review_required: nutrient.review_required,
      review_reason: nutrient.review_reason,
    });
  }

  for (const mark of extraction.marks) {
    add({
      record_type: "extracted_value",
      field: "diet mark",
      category: mark.kind,
      current_value: mark.kind,
      visual_description: mark.visual_description,
      image_index: mark.image_index,
      information_status: mark.review_required ? "unresolved" : "as read",
      review_required: mark.review_required,
      review_reason: mark.review_reason,
    });
  }

  for (const warning of extraction.warnings) {
    add({ record_type: "extraction_warning", field: "warning", current_value: warning });
  }

  const comparisonItems: ProfileResult[] = results.items;
  const findSource = (evidence: EvidenceItem) => {
    const candidates: Array<{ row: ReviewablePhrase; id: string; section: string; kind: string }> = [];
    extraction.ingredients.forEach((row) => candidates.push({
      row, id: row.id, section: "ingredients", kind: "ingredient",
    }));
    for (const bucket of ["contains", "may_contain", "other"] as const) {
      extraction.allergen_statements[bucket].forEach((row, index) => candidates.push({
        row,
        id: allergenCorrectionId(bucket, index),
        section: "allergen_statement",
        kind: bucket === "other" ? "may_contain" : bucket,
      }));
    }
    const matching = candidates.filter(({ row, section, kind }) =>
      section === evidence.section &&
      kind === evidence.kind &&
      row.evidence_quote === evidence.evidence_quote &&
      row.image_index === evidence.image_index &&
      row.label_text !== null,
    );
    const match = matching.find(({ row, id }) =>
      row.label_text === evidence.label_text || corrections[id] === evidence.label_text,
    ) ?? matching[0];
    if (!match) return null;
    const effectiveRow = match.id.startsWith("allergen:")
      ? (() => {
          const [, bucket, index] = match.id.split(":");
          return effective.allergen_statements[bucket as "contains" | "may_contain" | "other"][Number(index)];
        })()
      : effective.ingredients.find((row) => row.id === match.id);
    return { ...match, effectiveRow };
  };

  for (const item of comparisonItems) {
    add({
      record_type: "comparison",
      field: item.profile_key,
      comparison_target: item.profile_label,
      comparison_status: item.status,
      comparison_rule: item.rule_id,
      comparison_reason: item.reason,
    });
    for (const evidence of item.evidence) {
      const source = evidence.kind === "mark" ? null : findSource(evidence);
      const mark = evidence.kind === "mark"
        ? extraction.marks.find((candidate) =>
            candidate.image_index === evidence.image_index &&
            candidate.visual_description === evidence.visual_description,
          )
        : null;
      const wasEdited = source !== null && evidence.label_text !== source.row.label_text;
      const isConfirmed = source !== null && rowChecked[source.id] === true;
      const isReviewRequired = source?.effectiveRow?.review_required ?? mark?.review_required ?? false;
      const informationStatus = [
        wasEdited ? "user-corrected" : "",
        isConfirmed ? "user-confirmed against photo" : "",
        isReviewRequired ? "unresolved" : "",
      ].filter(Boolean).join("; ") || "as read";
      add({
        record_type: "comparison_evidence",
        field: item.profile_key,
        category: evidence.section,
        current_value: evidence.label_text,
        original_extracted_value: source?.row.label_text,
        evidence_quote: evidence.evidence_quote,
        visual_description: evidence.visual_description,
        image_index: evidence.image_index,
        information_status: informationStatus,
        review_required: isReviewRequired,
        review_reason: source?.row.review_reason ?? mark?.review_reason,
        comparison_target: item.profile_label,
        comparison_status: item.status,
        comparison_rule: item.rule_id,
        evidence_match: evidence.match_type,
        mapped_to: evidence.mapped_to,
        user_confirmation: isConfirmed ? "confirmed against photo" : "not confirmed",
      });
    }
  }

  const body = [COLUMNS.join(","), ...rows.map((entry) =>
    COLUMNS.map((column) => escapeCsvCell(entry[column])).join(","),
  )].join("\r\n");
  return `\uFEFF${body}\r\n`;
}

export function downloadScanCsv(input: Parameters<typeof buildScanCsv>[0]): void {
  const blob = new Blob([buildScanCsv(input)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const id = input.extraction.analysis_id.replace(/[^a-zA-Z0-9_-]+/gu, "-") || "current";
  link.href = url;
  link.download = `labellens-scan-${id}.csv`;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
