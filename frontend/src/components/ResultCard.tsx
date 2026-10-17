// One profile item's answer (Section 9 ResultCard): status badge, profile
// item, one-line reason, evidence list, and a link to open its source photo.

import type { EvidenceItem, ProfileResult } from "@shared/contracts";
import { StatusBadge } from "./StatusBadge";
import { EvidenceQuote, VisualMarkEvidence } from "./EvidenceQuote";
import { editedEvidenceKey } from "@state/applyCorrections";

export function ResultCard({
  result,
  editedEvidence,
  onFocusPhoto,
}: {
  result: ProfileResult;
  /** Evidence identities mapped to browser-local corrected wording. */
  editedEvidence: ReadonlyMap<string, string>;
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
                correctedText={editedEvidence.get(editedEvidenceKey(ev))}
                onFocusPhoto={onFocusPhoto}
              />
            ),
          )}
        </div>
      )}
    </article>
  );
}
