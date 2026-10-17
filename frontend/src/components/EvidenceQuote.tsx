// Evidence display (Section 9). Text evidence renders as an "As printed"
// quote with a "From your photo" source badge. A visual mark (diet symbol)
// shows its visual description and linked photo — never styled as a printed
// quote, never given a fabricated quote.

import type { EvidenceItem } from "@shared/contracts";
import { SourceBadge } from "./SourceBadge";
import { ZoomIcon } from "./icons";

export function EvidenceQuote({
  evidence,
  correctedText,
  onFocusPhoto,
}: {
  evidence: EvidenceItem;
  /** Browser-local corrected wording; source evidence remains unchanged. */
  correctedText?: string;
  onFocusPhoto?: (imageIndex: number | null) => void;
}) {
  const hasImage = evidence.image_index !== null && onFocusPhoto !== undefined;
  return (
    <figure className="evidence-quote">
      <blockquote>
        <span className="evidence-label">As printed</span>
        <p>“{evidence.evidence_quote}”</p>
      </blockquote>
      {correctedText !== undefined && (
        <div className="evidence-correction">
          <span className="evidence-label">Corrected wording</span>
          <p>{correctedText}</p>
        </div>
      )}
      <figcaption className="row">
        <SourceBadge kind="photo" />
        {correctedText !== undefined && <SourceBadge kind="edited" />}
        {evidence.mapped_to && (
          <span className="chip">
            {evidence.match_type === "alias"
              ? `alias for ${evidence.mapped_to}`
              : `matched: ${evidence.mapped_to}`}
          </span>
        )}
        {evidence.match_type === "unverified_suggestion" && (
          <span className="chip chip-warn">unverified suggestion</span>
        )}
        {hasImage && evidence.image_index !== null && (
          <button
            type="button"
            className="btn btn-quiet btn-sm evidence-focus"
            onClick={() => onFocusPhoto(evidence.image_index)}
          >
            <ZoomIcon size={15} />
            Open photo
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function VisualMarkEvidence({
  evidence,
  onFocusPhoto,
}: {
  evidence: EvidenceItem;
  onFocusPhoto?: (imageIndex: number | null) => void;
}) {
  const hasImage = evidence.image_index !== null && onFocusPhoto !== undefined;
  return (
    <figure className="evidence-mark">
      <div className="evidence-mark-desc">
        <span className="evidence-label">Symbol seen on pack</span>
        <p>{evidence.visual_description}</p>
      </div>
      <figcaption className="row">
        <SourceBadge kind="photo" />
        {hasImage && evidence.image_index !== null && (
          <button
            type="button"
            className="btn btn-quiet btn-sm evidence-focus"
            onClick={() => onFocusPhoto(evidence.image_index)}
          >
            <ZoomIcon size={15} />
            Open photo
          </button>
        )}
      </figcaption>
    </figure>
  );
}
