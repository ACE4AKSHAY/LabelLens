// CoverageSummary (Section 9): counts by status plus a coverage line.
// Deliberately NO overall verdict and no health score.

import type { Results } from "@shared/contracts";
import { STATUS_META } from "./StatusBadge";

const SECTION_LABELS: Record<string, string> = {
  ingredients: "Ingredients",
  allergen_statement: "Allergen line",
  nutrition: "Nutrition",
  product_details: "Product details",
};

const STATUS_SHORT: Record<string, string> = {
  readable_complete: "read fully",
  readable_partial: "partly read",
  unreadable: "couldn't be read",
  not_uploaded: "not uploaded",
  ambiguous: "unclear",
};

export function CoverageSummary({
  results,
  packHasNoAllergenStatement,
}: {
  results: Results;
  packHasNoAllergenStatement: boolean;
}) {
  const order = [
    "conflict",
    "possible_conflict",
    "unknown",
    "no_match_found",
  ] as const;
  const counts = order
    .map((status) => ({ status, n: results.summary[status] ?? 0 }))
    .filter((c) => c.n > 0);

  const coverageParts = (
    [
      ["ingredients", results.coverage.ingredients],
      [
        "allergen_statement",
        packHasNoAllergenStatement
          ? "readable_complete"
          : results.coverage.allergen_statement,
      ],
      ["nutrition", results.coverage.nutrition],
      ["product_details", results.coverage.product_details],
    ] as const
  ).map(([key, status]) => {
    const extra =
      key === "ingredients" && results.coverage.ingredients_confirmed
        ? ", you confirmed complete"
        : "";
    const extraAllergen =
      key === "allergen_statement" && packHasNoAllergenStatement
        ? " — you said this pack has none"
        : key === "allergen_statement" && results.coverage.allergen_statement_checked
          ? ", you confirmed"
          : "";
    return `${SECTION_LABELS[key]}: ${STATUS_SHORT[status] ?? status}${extra}${extraAllergen}`;
  });

  return (
    <section className="card coverage-card" aria-label="Summary and coverage">
      <div className="card-heading">
        <h2>What the label showed</h2>
      </div>
      {counts.length === 0 ? (
        <p className="muted">Nothing to summarize yet.</p>
      ) : (
        <ul className="coverage-counts">
          {counts.map(({ status, n }) => (
            <li key={status} className="coverage-count">
              <StatusCountPill status={status} />
              <span className="coverage-n">
                {n} {n === 1 ? "item" : "items"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="coverage-line small muted">
        {coverageParts.join(" · ")}
      </p>
    </section>
  );
}

function StatusCountPill({ status }: { status: keyof Results["summary"] }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="status-badge"
      style={{
        color: meta.color,
        background: meta.soft,
        borderStyle: meta.border,
        borderColor: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}
