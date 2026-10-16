// Ordered results from the deterministic browser-side comparison engine.

import type { Results } from "@shared/contracts";
import { ResultCard } from "./ResultCard";

export function ResultsList({
  results,
  editedEvidence,
  onFocusPhoto,
}: {
  results: Results;
  editedEvidence: ReadonlyMap<string, string>;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  if (results.items.length === 0) {
    return (
      <section className="card" aria-label="Results">
        <p className="muted">
          Add at least one allergen, custom term, or diet preference to your
          profile to see results.
        </p>
      </section>
    );
  }

  return (
    <div className="results-list" aria-label="Results">
      {results.items.map((item) => (
        <ResultCard
          key={item.profile_key}
          result={item}
          editedEvidence={editedEvidence}
          onFocusPhoto={onFocusPhoto}
        />
      ))}
    </div>
  );
}
