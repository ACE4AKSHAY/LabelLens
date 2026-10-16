// The ordered result cards, plus the mock-mode golden-preview banner.
// In mock mode with the rules stub, built-in packs show their hand-written
// golden preview clearly labeled — never presented as a live judgment.

import type { Results } from "@shared/contracts";
import { ResultCard } from "./ResultCard";
import { SourceBadge } from "./SourceBadge";

export function ResultsList({
  results,
  expectedPreview,
  editedLabels,
  onFocusPhoto,
}: {
  results: Results;
  /** Mock-mode golden preview; when present it is rendered, clearly labeled. */
  expectedPreview: Results | null;
  editedLabels: Set<string>;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  const shown = expectedPreview ?? results;
  if (shown.items.length === 0) {
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
      {expectedPreview && (
        <div className="note note-preview" role="note">
          <SourceBadge kind="golden-preview" />
          <span className="small">
            Mock mode: these cards show the hand-checked golden outcome for this
            sample. With the rules engine connected, cards come from
            <code> compareProfile</code> on the extraction itself.
          </span>
        </div>
      )}
      {shown.items.map((item) => (
        <ResultCard
          key={item.profile_key}
          result={item}
          editedLabels={editedLabels}
          onFocusPhoto={onFocusPhoto}
        />
      ))}
    </div>
  );
}
