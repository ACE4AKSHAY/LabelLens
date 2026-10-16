// WarningsPanel: surfaces extraction.warnings in the results view. Each
// warning keeps the exact printed phrase (when the warning references one)
// and its "Show on photo" link; an "Inspect reading" action jumps to the row
// in the review tables. Warnings are reading flags to double-check — never
// verdicts, never confirmations.

import { useMemo } from "react";
import type { Extraction } from "@shared/contracts";
import { warningLinks } from "@state/warningLinks";
import { SourceBadge } from "./SourceBadge";
import { WarningIcon, ZoomIcon } from "./icons";

export function WarningsPanel({
  extraction,
  onFocusPhoto,
  onInspectRow,
}: {
  extraction: Extraction;
  onFocusPhoto: (imageIndex: number | null) => void;
  onInspectRow: (rowId: string) => void;
}) {
  const linked = useMemo(
    () =>
      extraction.warnings.map((text) => ({
        text,
        links: warningLinks(extraction, text),
      })),
    [extraction],
  );

  if (extraction.warnings.length === 0) return null;

  return (
    <section className="card warnings-panel" aria-label="Reading warnings">
      <div className="card-heading">
        <h2>
          <WarningIcon className="inline-icon" /> Reading warnings
        </h2>
        <span className="chip">{extraction.warnings.length}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Flagged while reading your photo. These point to exact print to check —
        they are not results and not confirmations.
      </p>
      <ul className="warnings-list">
        {linked.map(({ text, links }, i) => (
          <li key={i} className="warning-item">
            <p className="warning-text">{text}</p>
            {links.photoIndex !== null && (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onFocusPhoto(links.photoIndex)}
              >
                <ZoomIcon size={15} />
                Show on photo {links.photoIndex + 1}
              </button>
            )}
            {links.rows.map((row) => (
              <div key={row.rowId} className="warning-row-link">
                <blockquote className="warning-quote">
                  <span className="evidence-label">As printed</span>
                  <p>“{row.printedText}”</p>
                </blockquote>
                <figcaption className="row">
                  <SourceBadge kind="photo" />
                  <span className="chip">{row.sectionLabel}</span>
                  {row.imageIndex !== null && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => onFocusPhoto(row.imageIndex)}
                    >
                      <ZoomIcon size={15} />
                      Show on photo
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onInspectRow(row.rowId)}
                  >
                    Inspect reading
                  </button>
                </figcaption>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
