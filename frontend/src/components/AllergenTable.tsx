// Browser-local review and correction for extracted allergen phrases.
// The original quote and image index remain untouched in the extraction.

import { useState } from "react";
import type { Extraction } from "@shared/contracts";
import {
  allergenCorrectionId,
  type AllergenBucket,
} from "@state/applyCorrections";
import { SourceBadge } from "./SourceBadge";
import { CheckIcon, EditIcon, ZoomIcon } from "./icons";

const GROUPS: { bucket: AllergenBucket; label: string }[] = [
  { bucket: "contains", label: "Contains" },
  { bucket: "may_contain", label: "May contain" },
  { bucket: "other", label: "Other statement" },
];

export function AllergenTable({
  extraction,
  corrections,
  rowChecked,
  onCorrect,
  onRestore,
  onCheckRow,
  onFocusPhoto,
}: {
  extraction: Extraction;
  corrections: Record<string, string>;
  rowChecked: Record<string, boolean>;
  onCorrect: (id: string, newText: string) => void;
  onRestore: (id: string) => void;
  onCheckRow: (id: string) => void;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const phraseCount = GROUPS.reduce(
    (sum, group) => sum + extraction.allergen_statements[group.bucket].length,
    0,
  );

  if (phraseCount === 0) {
    return (
      <p className="muted" role="note">
        No allergen phrases were extracted. Missing OCR text does not show that
        the pack has no allergens. Add a clearer photo if the allergen line
        wasn&apos;t fully visible.
      </p>
    );
  }

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setDraft(corrections[id] ?? text);
  };

  const commitEdit = (id: string, originalText: string) => {
    const text = draft.trim();
    if (text.length === 0) {
      setEditingId(null);
      return;
    }
    if (text === originalText) {
      if (corrections[id] !== undefined) onRestore(id);
    } else {
      onCorrect(id, text);
    }
    setEditingId(null);
  };

  return (
    <div className="table-wrap">
      <table className="data allergen-table">
        <thead>
          <tr>
            <th scope="col">Statement and correction</th>
            <th scope="col">Original evidence</th>
            <th scope="col">Edit</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.flatMap(({ bucket, label }) =>
            extraction.allergen_statements[bucket].map((phrase, index) => {
              const id = allergenCorrectionId(bucket, index);
              const needsReview =
                phrase.review_required && rowChecked[id] !== true;
              const correctedText = corrections[id];
              const edited =
                correctedText !== undefined &&
                correctedText !== phrase.label_text;

              return (
                <tr
                  key={id}
                  className={needsReview ? "row-review" : undefined}
                >
                  <td>
                    <p className="small muted">{label}</p>
                    {editingId === id ? (
                      <div className="edit-cell">
                        <label
                          className="visually-hidden"
                          htmlFor={"edit-" + id}
                        >
                          Correct this {label.toLowerCase()} phrase
                        </label>
                        <input
                          id={"edit-" + id}
                          className="text-input"
                          value={draft}
                          autoFocus
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitEdit(id, phrase.label_text);
                            }
                            if (event.key === "Escape") setEditingId(null);
                          }}
                        />
                        <div className="row">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => commitEdit(id, phrase.label_text)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="printed-text">{phrase.label_text}</p>
                        {edited && (
                          <div className="correction-detail">
                            <SourceBadge kind="edited" />
                            <p>
                              <strong>Corrected wording:</strong>{" "}
                              {correctedText}
                            </p>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              onClick={() => onRestore(id)}
                            >
                              Restore original reading
                            </button>
                          </div>
                        )}
                        {needsReview && (
                          <div className="review-cell">
                            <SourceBadge kind="unresolved" />
                            <p className="small review-reason">
                              {phrase.review_reason ??
                                "This phrase is flagged for review."}
                            </p>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => onCheckRow(id)}
                            >
                              <CheckIcon size={15} />
                              I checked this phrase against the photo
                            </button>
                          </div>
                        )}
                        {!needsReview && rowChecked[id] === true && (
                          <p className="small muted row-check-note">
                            <SourceBadge kind="confirmed" />
                          </p>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <blockquote className="allergen-evidence">
                      “{phrase.evidence_quote}”
                    </blockquote>
                    <div className="row">
                      <SourceBadge kind="photo" />
                      {phrase.image_index !== null && (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => onFocusPhoto(phrase.image_index)}
                        >
                          <ZoomIcon size={15} />
                          Show on photo
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {editingId !== id && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => startEdit(id, phrase.label_text)}
                      >
                        <EditIcon size={15} />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
