// App shell: header, step strip, the two pages, the dev fixture picker
// (?dev=1), and the reading state. Profile in localStorage; active scan in
// memory only.

import { useCallback, useMemo, useState } from "react";
import { ProfileProvider } from "@state/profileStore";
import { ScanProvider, useScan } from "@state/scanStore";
import { StepStrip, type Step } from "@components/StepStrip";
import { DevFixturePicker } from "@components/DevFixturePicker";
import { PersistentNote } from "@components/PersistentNote";
import { ProfilePage } from "@pages/ProfilePage";
import { ScanPage } from "@pages/ScanPage";
import { extractMode } from "@api/extract";
import type { ExtractOutcome } from "@api/extract";
import { DEFAULT_MOCK_PACK_ID, getPackById, type FixturePack } from "@api/mocks";
import { FlaskIcon } from "@components/icons";

function isDevSession(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("dev") === "1";
  } catch {
    return false;
  }
}

interface AppProps {
  activePack: FixturePack | null;
  simulateError: boolean;
  onPickFixture: (pack: FixturePack) => void;
  onToggleSimulateError: () => void;
}

function AppBody({
  activePack,
  simulateError,
  onPickFixture,
  onToggleSimulateError,
}: AppProps) {
  const { scan, clearScan, loadFixtureDirect } = useScan();
  const [step, setStep] = useState<Step>("profile");
  const [devOpen, setDevOpen] = useState(isDevSession);

  const maxReached: Step =
    scan.phase === "results" && scan.results
      ? "results"
      : "photo";

  const current: Step =
    step === "results" && scan.phase !== "results" ? "photo" : step;

  const goStep = useCallback(
    (next: Step) => {
      if (next === "results" && scan.phase !== "results") return;
      setStep(next);
      window.scrollTo({ top: 0 });
    },
    [scan.phase],
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 32 32" focusable="false">
                <circle cx="14" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
                <line x1="19" y1="19" x2="25" y2="25" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="brand-name">LabelLens</span>
          </div>
          <div className="header-actions">
            {isDevSession() && (
              <button
                type="button"
                className="btn btn-quiet btn-sm dev-toggle"
                aria-expanded={devOpen}
                onClick={() => setDevOpen((v) => !v)}
              >
                <FlaskIcon size={15} />
                Dev fixtures
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                clearScan();
                setStep("profile");
                window.scrollTo({ top: 0 });
              }}
            >
              Start over
            </button>
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content">
        <StepStrip current={current} maxReached={maxReached} onGo={goStep} />

        {scan.phase === "reading" ? (
          <>
            <section className="card reading-card" aria-live="polite" aria-busy="true">
              <p className="reading-title">Reading the label…</p>
              <p className="muted small">
                We transcribe the text exactly as printed and show what we could
                and couldn't read. This takes a few seconds.
              </p>
              <div className="reading-bar" aria-hidden="true">
                <div className="reading-bar-fill" />
              </div>
            </section>
            <PersistentNote compact />
          </>
        ) : current === "profile" ? (
          <ProfilePage onContinue={() => goStep("photo")} />
        ) : (
          <ScanPage onEditProfile={() => goStep("profile")} />
        )}
      </main>

      <footer className="app-footer">
        <PersistentNote compact />
        <p className="small muted">
          Not a medical tool · No health scores · Your profile stays in this
          browser
        </p>
      </footer>

      <DevFixturePicker
        open={devOpen && isDevSession()}
        onToggle={() => setDevOpen(false)}
        activePackId={activePack?.id ?? null}
        onPick={(pack) => {
          onPickFixture(pack);
          // Dev convenience: show this fixture immediately, no photo needed.
          loadFixtureDirect(pack.extraction);
          setStep("results");
          setDevOpen(false);
          window.scrollTo({ top: 0 });
        }}
        simulateError={simulateError}
        onToggleError={onToggleSimulateError}
      />
    </div>
  );
}

export default function App() {
  const isMock = extractMode() === "mock";
  const [activePack, setActivePack] = useState<FixturePack | null>(null);
  const [simulateError, setSimulateError] = useState(false);

  // Mock-mode scan loader: the dev picker chooses what a scan returns.
  const loadOutcome = useMemo(() => {
    if (!isMock) return undefined;
    return async (): Promise<ExtractOutcome> => {
      if (simulateError) {
        throw Object.assign(
          new Error(
            "The vision provider has no quota left right now. Try again in a moment, or pick another sample.",
          ),
          { code: "quota", retryable: true },
        );
      }
      const pack = activePack ?? getPackById(DEFAULT_MOCK_PACK_ID)!;
      return { extraction: pack.extraction };
    };
  }, [isMock, activePack, simulateError]);

  return (
    <ProfileProvider>
      <ScanProvider loadOutcome={loadOutcome}>
        <AppBody
          activePack={activePack}
          simulateError={simulateError}
          onPickFixture={(pack) => {
            setActivePack(pack);
            setSimulateError(false);
          }}
          onToggleSimulateError={() => setSimulateError((v) => !v)}
        />
      </ScanProvider>
    </ProfileProvider>
  );
}
