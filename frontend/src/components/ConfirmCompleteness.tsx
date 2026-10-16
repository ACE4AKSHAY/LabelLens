// ConfirmCompleteness (Section 9): the two user confirmations the rules need.
// These are the user's statements about the physical pack — never inferred
// from the photo.

import type { ConfirmState } from "@shared/contracts";

export function ConfirmCompleteness({
  confirm,
  onChange,
}: {
  confirm: ConfirmState;
  onChange: (next: Partial<ConfirmState>) => void;
}) {
  return (
    <section className="card confirm-card" aria-label="Confirm what the pack shows">
      <div className="card-heading">
        <h2>Check the pack</h2>
      </div>
      <p className="muted confirm-intro">
        Only you can see the whole pack. These two answers decide how far your
        results can be trusted.
      </p>

      <fieldset className="confirm-group">
        <legend>Is this the whole ingredient list?</legend>
        <div className="confirm-options">
          <label className="check-option">
            <input
              type="radio"
              name="ingredients-complete"
              checked={confirm.ingredients_complete}
              onChange={() => onChange({ ingredients_complete: true })}
            />
            <span>Yes — the whole list is visible in my photo</span>
          </label>
          <label className="check-option">
            <input
              type="radio"
              name="ingredients-complete"
              checked={!confirm.ingredients_complete}
              onChange={() => onChange({ ingredients_complete: false })}
            />
            <span>No / not sure</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="confirm-group">
        <legend>Does the pack show an allergen / “may contain” line?</legend>
        <div className="confirm-options">
          <label className="check-option">
            <input
              type="radio"
              name="allergen-line"
              checked={confirm.allergen_statement_complete}
              onChange={() =>
                onChange({ allergen_statement_complete: true })
              }
            />
            <span>Yes — the line is fully visible in my photo</span>
          </label>
          <label className="check-option">
            <input
              type="radio"
              name="allergen-line"
              checked={confirm.pack_has_no_allergen_statement}
              onChange={() =>
                onChange({ pack_has_no_allergen_statement: true })
              }
            />
            <span>This pack has no allergen line at all</span>
          </label>
          <label className="check-option">
            <input
              type="radio"
              name="allergen-line"
              checked={
                !confirm.allergen_statement_complete &&
                !confirm.pack_has_no_allergen_statement
              }
              onChange={() =>
                onChange({
                  allergen_statement_complete: false,
                  pack_has_no_allergen_statement: false,
                })
              }
            />
            <span>Not sure</span>
          </label>
        </div>
      </fieldset>
    </section>
  );
}
