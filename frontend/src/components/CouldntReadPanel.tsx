// CouldntReadPanel (Section 9): every section that is partial, unreadable,
// ambiguous, or not uploaded — each with a targeted "Retake this panel"
// action that names which photo to shoot and how.

import type { Extraction, SectionStatus } from "@shared/contracts";
import { WarningIcon } from "./icons";

const SECTION_TIPS: Record<
  string,
  { label: string; what: string; how: string; photoIndex: number | null }
> = {
  ingredients: {
    label: "Ingredients",
    what: "the ingredient list",
    how: "Shoot the list straight-on, flat, close enough that every line is sharp — no glare, and keep the whole list inside the frame.",
    photoIndex: null,
  },
  allergen_statement: {
    label: "Allergen line",
    what: "the “contains / may contain” line",
    how: "Usually near the ingredient list or the end of the pack. Include the whole sentence in one photo.",
    photoIndex: null,
  },
  nutrition: {
    label: "Nutrition",
    what: "the nutrition table",
    how: "Shoot the table flat and in even light; turn off the flash to avoid glare on the numbers.",
    photoIndex: null,
  },
  product_details: {
    label: "Product details",
    what: "the name, quantity, and dates",
    how: "The bottom or back seam usually carries the name, net quantity, and dates. Keep the text uncurved where you can.",
    photoIndex: null,
  },
};

function statusWord(status: SectionStatus): string {
  switch (status) {
    case "readable_partial":
      return "only partly readable";
    case "unreadable":
      return "couldn't be read";
    case "not_uploaded":
      return "not in your photos";
    case "ambiguous":
      return "too unclear to rely on";
    default:
      return status;
  }
}

export function CouldntReadPanel({
  extraction,
  onRetakePrompt,
}: {
  extraction: Extraction;
  onRetakePrompt: () => void;
}) {
  const problems = (
    [
      "ingredients",
      "allergen_statement",
      "nutrition",
      "product_details",
    ] as const
  )
    .map((key) => ({ key, reading: extraction.sections[key] }))
    .filter(({ reading }) => reading.status !== "readable_complete");

  if (problems.length === 0) return null;

  return (
    <section className="card couldnt-read" aria-label="Panels we couldn't read">
      <div className="card-heading">
        <h2>
          <WarningIcon className="inline-icon" /> Couldn't read fully
        </h2>
      </div>
      <ul className="couldnt-list">
        {problems.map(({ key, reading }) => {
          const tip = SECTION_TIPS[key];
          const photoLabel =
            reading.image_index !== null
              ? ` (photo ${reading.image_index + 1})`
              : "";
          return (
            <li key={key} className="couldnt-item">
              <p className="couldnt-title">
                <strong>{tip.label}</strong> — {statusWord(reading.status)}
                {photoLabel}
              </p>
              {reading.reason && (
                <p className="small muted">{reading.reason}</p>
              )}
              <p className="small retake-tip">
                To retake {tip.what}: {tip.how}
              </p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={onRetakePrompt}
              >
                Retake this panel
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
