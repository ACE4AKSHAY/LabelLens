// IngredientTable (Section 9): As printed · Recognized as · Edit.
// "Recognized as" appears only when the alias map supports it; model
// suggestions are labeled "unverified suggestion". Rows needing review are
// emphasized and offer "I checked this row against the photo".

import { useState } from "react";
import type { Extraction, IngredientRow } from "@shared/contracts";
import type { AliasMap } from "@domain/compareProfile";
import { SourceBadge } from "./SourceBadge";
import { CheckIcon, EditIcon, ZoomIcon } from "./icons";

interface AliasLookup {
  byTerm: Map<string, AliasMap["entries"][number]>;
  dietTerms: AliasMap["diet_terms"];
}

function buildAliasLookup(aliasMap: AliasMap): AliasLookup {
  return {
    byTerm: new Map(
      aliasMap.entries.map((entry) => [entry.term.toLowerCase(), entry]),
    ),
    dietTerms: aliasMap.diet_terms,
  };
}

function normalizedFor(row: IngredientRow, displayedText: string): string | null {
  // In the real pipeline Person 3's normalizer decides "recognized as".
  // Until then the UI shows only what the (empty) alias map supports.
  const lower = displayedText.trim().toLowerCase();
  return lower.length > 0 ? lower : null;
}

export function IngredientTable({
  extraction,
  aliasMap,
  corrections,
  rowChecked,
  onCorrect,
  onRestore,
  onCheckRow,
  onFocusPhoto,
}: {
  extraction: Extraction;
  aliasMap: AliasMap;
  corrections: Record<string, string>;
  rowChecked: Record<string, boolean>;
  onCorrect: (id: string, newText: string) => void;
  onRestore: (id: string) => void;
  onCheckRow: (id: string) => void;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  const lookup = buildAliasLookup(aliasMap);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const rows = extraction.ingredients;
  if (rows.length === 0) {
    const status = extraction.sections.ingredients.status;
    return (
      <p className="muted" role="note">
        {status === "not_uploaded"
          ? "No ingredient panel was uploaded. Add a clear photo of the full ingredient list."
          : "No ingredient rows were extracted. Missing OCR text does not establish that the list is empty. Add a clearer photo if the full list was not captured."}
      </p>
    );
  }

  const startEdit = (row: IngredientRow) => {
    setEditingId(row.id);
    setDraft(corrections[row.id] ?? row.label_text);
  };

  const commitEdit = (row: IngredientRow) => {
    const text = draft.trim();
    if (text.length === 0) {
      setEditingId(null);
      return;
    }
    if (text === row.label_text) {
      if (corrections[row.id] !== undefined) onRestore(row.id);
    } else {
      onCorrect(row.id, text);
    }
    setEditingId(null);
  };

  return (
    <div className="table-wrap">
      <table className="data ingredient-table">
        <thead>
          <tr>
            <th scope="col">As printed</th>
            <th scope="col">Recognized as</th>
            <th scope="col">Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const needsReview = row.review_required && !rowChecked[row.id];
            const correctedText = corrections[row.id];
            const edited =
              row.edited_by_user === true ||
              (correctedText !== undefined && correctedText !== row.label_text);
            const aliasEntry = lookup.byTerm.get(
              normalizedFor(row, correctedText ?? row.label_text) ?? "",
            );
            const suggestion = row.suggested_group ?? null;

            return (
              <tr
                key={row.id}
                className={needsReview ? "row-review" : undefined}
              >
                <td>
                  {editingId === row.id ? (
                    <div className="edit-cell">
                      <label className="visually-hidden" htmlFor={`edit-${row.id}`}>
                        Correct the printed text for {row.label_text}
                      </label>
                      <input
                        id={`edit-${row.id}`}
                        className="text-input"
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(row);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => commitEdit(row)}
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
                      <span className="printed-text">{row.label_text}</span>
                      {edited && (
                        <div className="correction-detail">
                          <SourceBadge kind="edited" />
                          {correctedText !== undefined &&
                            correctedText !== row.label_text && (
                              <p>
                                <strong>Corrected wording:</strong>{" "}
                                {correctedText}
                              </p>
                            )}
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm"
                            onClick={() => onRestore(row.id)}
                          >
                            Restore original reading
                          </button>
                        </div>
                      )}
                      {needsReview && (
                        <div className="review-cell">
                          <SourceBadge kind="unresolved" />
                          <p className="small review-reason">
                            {row.review_reason ??
                              "This row is flagged for review."}
                          </p>
                          <div className="row">
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => onCheckRow(row.id)}
                            >
                              <CheckIcon size={15} />
                              I checked this row against the photo
                            </button>
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
                          </div>
                        </div>
                      )}
                      {!needsReview && rowChecked[row.id] && (
                        <p className="small muted row-check-note">
                          <CheckIcon size={14} /> You checked this row against
                          the photo. <SourceBadge kind="confirmed" />
                        </p>
                      )}
                    </>
                  )}
                </td>
                <td>
                  {aliasEntry ? (
                    <div>
                      <span>{aliasEntry.canonical ?? aliasEntry.group}</span>
                      <span className="chip chip-mapping">
                        {aliasEntry.reviewed ? "reviewed" : "unverified"}
                      </span>
                      {aliasEntry.scientific_name && aliasEntry.reviewed && (
                        <span className="small muted sci-name">
                          {aliasEntry.scientific_name}
                        </span>
                      )}
                    </div>
                  ) : suggestion ? (
                    <div>
                      <span>{suggestion.group}</span>
                      <span className="chip chip-warn">
                        unverified suggestion
                      </span>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {editingId !== row.id && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => startEdit(row)}
                    >
                      <EditIcon size={15} />
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
