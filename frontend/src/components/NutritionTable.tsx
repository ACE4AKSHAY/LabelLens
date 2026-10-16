// NutritionTable (Section 9): nutrient, printed value, unit, and serving
// basis, preserving the evidence phrase. Unknown/unreadable is shown
// differently from a measured zero. Display only — no thresholds, no score.

import type { Extraction } from "@shared/contracts";
import { SourceBadge } from "./SourceBadge";
import { ZoomIcon } from "./icons";

export function NutritionTable({
  extraction,
  onFocusPhoto,
}: {
  extraction: Extraction;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  const section = extraction.sections.nutrition;
  const rows = extraction.nutrition;

  if (section.status === "not_uploaded") {
    return (
      <div className="empty-inline">
        <p className="muted">
          The nutrition panel wasn't in the photos you uploaded, so nothing can
          be shown. Add a photo of that panel to see it.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-inline">
        <p className="muted">
          {section.status === "unreadable"
            ? "The nutrition panel couldn't be read."
            : "No nutrition values could be read."}{" "}
          {section.reason ? `(${section.reason})` : null}
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data nutrition-table">
        <thead>
          <tr>
            <th scope="col">Nutrient</th>
            <th scope="col">As printed</th>
            <th scope="col">Basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const readable = row.amount_text !== null;
            const basis = row.basis ?? "basis not visible";
            return (
              <tr
                key={row.id}
                className={!readable || row.review_required ? "row-review" : undefined}
              >
                <td>{row.nutrient ?? <span className="muted">not readable</span>}</td>
                <td>
                  {readable ? (
                    <span className="printed-text">
                      {row.amount_text} {row.unit ?? ""}
                    </span>
                  ) : (
                    <span className="unreadable-chip">couldn't read the value</span>
                  )}
                  {row.review_required && !readable && row.review_reason && (
                    <p className="small review-reason">{row.review_reason}</p>
                  )}
                  {row.evidence_quote && (
                    <p className="small muted nutrition-quote">“{row.evidence_quote}”</p>
                  )}
                  {row.image_index !== null && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => onFocusPhoto(row.image_index)}
                    >
                      <ZoomIcon size={15} />
                      Show on photo
                    </button>
                  )}
                </td>
                <td>
                  {row.basis ? (
                    basis
                  ) : (
                    <span className="unreadable-chip">basis not visible</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 8 }}>
        <SourceBadge kind="photo" /> Values are shown exactly as printed —
        including the printed zero and values that couldn't be read. LabelLens
        doesn't score or judge nutrition.
      </p>
    </div>
  );
}
