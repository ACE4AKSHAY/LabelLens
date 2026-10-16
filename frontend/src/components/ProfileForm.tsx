// ProfileForm (Section 9): allergen presets, custom avoid terms, diet.
// Saved to localStorage via the profile store; supports edit and clear.

import { useState } from "react";
import {
  ALLERGEN_PRESETS,
  DIET_OPTIONS,
  useProfile,
} from "@state/profileStore";
import { XIcon } from "./icons";

export function ProfileForm({
  onSaved,
}: {
  /** Optional callback after a meaningful change (e.g. navigate to photos). */
  onSaved?: () => void;
}) {
  const { profile, setProfile, clearProfile } = useProfile();
  const [customDraft, setCustomDraft] = useState("");

  const toggleAllergen = (key: string) => {
    const has = profile.allergens.includes(key);
    setProfile({
      ...profile,
      allergens: has
        ? profile.allergens.filter((k) => k !== key)
        : [...profile.allergens, key],
    });
  };

  const addCustom = () => {
    const term = customDraft.trim();
    if (!term) return;
    const exists = profile.custom_avoid.some(
      (t) => t.toLowerCase() === term.toLowerCase(),
    );
    if (!exists) {
      setProfile({ ...profile, custom_avoid: [...profile.custom_avoid, term] });
    }
    setCustomDraft("");
  };

  const removeCustom = (term: string) => {
    setProfile({
      ...profile,
      custom_avoid: profile.custom_avoid.filter((t) => t !== term),
    });
  };

  const setDiet = (diet: (typeof DIET_OPTIONS)[number]["value"]) => {
    setProfile({ ...profile, diet });
  };

  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        addCustom();
      }}
    >
      <fieldset className="profile-group">
        <legend>Allergens to avoid</legend>
        <p className="small muted">
          Pick what you need to steer clear of. You can change this any time.
        </p>
        <div className="check-grid">
          {ALLERGEN_PRESETS.map(({ key, label }) => {
            const on = profile.allergens.includes(key);
            return (
              <label key={key} className={`check-option ${on ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleAllergen(key)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="profile-group">
        <legend>Other ingredients you avoid</legend>
        <p className="small muted">
          Matched exactly as printed on the pack — for example “sulphite” or a
          brand name.
        </p>
        {profile.custom_avoid.length > 0 && (
          <ul className="custom-terms">
            {profile.custom_avoid.map((term) => (
              <li key={term} className="custom-term">
                {term}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  aria-label={`Remove ${term}`}
                  onClick={() => removeCustom(term)}
                >
                  <XIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="custom-add row">
          <label className="visually-hidden" htmlFor="custom-term">
            Add an ingredient to avoid
          </label>
          <input
            id="custom-term"
            className="text-input"
            placeholder="e.g. sulphites"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={customDraft.trim().length === 0}
            onClick={addCustom}
          >
            Add
          </button>
        </div>
      </fieldset>

      <fieldset className="profile-group">
        <legend>Diet</legend>
        <div className="check-grid check-grid-diet">
          {DIET_OPTIONS.map(({ value, label, hint }) => {
            const on = profile.diet === value;
            return (
              <label key={value} className={`check-option ${on ? "on" : ""}`}>
                <input
                  type="radio"
                  name="diet"
                  checked={on}
                  onChange={() => setDiet(value)}
                />
                <span>
                  {label}
                  {hint && <span className="small muted"> — {hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="row profile-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSaved?.()}
        >
          Save and continue
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            clearProfile();
            setCustomDraft("");
          }}
        >
          Clear profile
        </button>
      </div>
      <p className="small muted">
        Your profile is saved only in this browser (localStorage) and is never
        sent anywhere.
      </p>
    </form>
  );
}
