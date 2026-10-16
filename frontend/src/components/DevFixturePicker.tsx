// Dev-only fixture picker (Section 9, `?dev=1`). Loads fictional extractions
// without the backend so the comparison rules can be exercised interactively.

import { listPacks, ERROR_SIM_ID, type FixturePack } from "@api/mocks";
import { extractMode } from "@api/extract";
import { FlaskIcon, XIcon } from "./icons";

export function DevFixturePicker({
  open,
  onToggle,
  activePackId,
  onPick,
  simulateError,
  onToggleError,
}: {
  open: boolean;
  onToggle: () => void;
  activePackId: string | null;
  onPick: (pack: FixturePack) => void;
  simulateError: boolean;
  onToggleError: () => void;
}) {
  if (!open) return null;
  const packs = listPacks();
  const mode = extractMode();

  return (
    <aside className="dev-picker" aria-label="Developer fixture picker">
      <div className="dev-picker-head">
        <h2>
          <FlaskIcon size={16} className="inline-icon" /> Dev fixtures
          <span className="chip">{mode}</span>
        </h2>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          aria-label="Close dev panel"
          onClick={onToggle}
        >
          <XIcon size={16} />
        </button>
      </div>
      <p className="small muted">
        Loads a preloaded sample extraction; it does not call OCR. Results are
        recomputed against your browser profile by the rules engine.
      </p>
      <ul className="dev-list">
        {packs.map((pack) => (
          <li key={pack.id}>
            <button
              type="button"
              className={`dev-item ${activePackId === pack.id ? "dev-item-active" : ""}`}
              onClick={() => onPick(pack)}
            >
              <span className="dev-item-title">{pack.title}</span>
              <span className="small muted">{pack.description}</span>
              {pack.source === "shared" && (
                <span className="chip chip-mapping">shared fixture</span>
              )}
              {pack.demoPhotoPath && (
                <span className="chip chip-mapping">local photo, omitted from Git</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <label className="check-option dev-error-toggle">
        <input
          type="checkbox"
          checked={simulateError}
          onChange={onToggleError}
        />
        <span>Next scan fails with a provider error</span>
      </label>
      <p className="small muted">
        Error simulation uses the mock file name “{ERROR_SIM_ID}”.
      </p>
    </aside>
  );
}
