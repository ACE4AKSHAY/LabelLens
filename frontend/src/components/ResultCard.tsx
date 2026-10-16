// One profile item's answer (Section 9 ResultCard): status badge, profile
// item, one-line reason, evidence list, "show on photo" on each evidence item.

import type { EvidenceItem, ProfileResult } from "@shared/contracts";
import { StatusBadge } from "./StatusBadge";
import { EvidenceQuote, VisualMarkEvidence } from "./EvidenceQuote";

export function ResultCard({
  result,
  editedLabels,
  onFocusPhoto,
}: {
  result: ProfileResult;
  /** Label texts the user edited (evidence shows "Edited by you"). */
  editedLabels?: Set<string>;
  onFocusPhoto?: (imageIndex: number | null) => void;
}) {
  return (
    <article className={`result-card result--${result.status}`}>
      <header className="result-head">
        <StatusBadge status={result.status} />
        <h3 className="result-title">{result.profile_label}</h3>
      </header>
      <p className="result-reason">{result.reason}</p>
      {result.evidence.length > 0 && (
        <div className="result-evidence">
          {result.evidence.map((ev: EvidenceItem, i: number) =>
            ev.kind === "mark" ? (
              <VisualMarkEvidence
                key={i}
                evidence={ev}
                onFocusPhoto={onFocusPhoto}
              />
            ) : (
              <EvidenceQuote
                key={i}
                evidence={ev}
                edited={editedLabels?.has(ev.label_text ?? "") === true}
                onFocusPhoto={onFocusPhoto}
              />
            ),
          )}
        </div>
      )}
    </article>
  );
}
