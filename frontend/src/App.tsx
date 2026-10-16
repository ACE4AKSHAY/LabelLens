// App shell: header, step strip, the two pages, the dev fixture picker
// (?dev=1), and the reading state. Profile in localStorage; active scan in
// memory only.

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (scan.phase !== "reading") {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const updateElapsed = () =>
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [scan.phase]);

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
              <div className="reading-spinner" role="status" aria-label="Reading photos" />
              <p className="reading-title">Reading the label…</p>
              <p className="muted small">
                We transcribe visible words, preserve source evidence, and flag
                anything the model cannot read. The primary model can use its
                configured fallback if it fails.
              </p>
              <p className="reading-elapsed small muted">
                {elapsedSeconds < 30
                  ? "Waiting for the vision service"
                  : elapsedSeconds < 60
                    ? "Still processing. Larger photos or a busy service can take longer."
                    : "This may take a few minutes if the backend tries a fallback model. Keep this page open; a failure will show its reason and request ID."}{" "}
                · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
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
          void (async () => {
            let photoFile: File | undefined;
            if (pack.demoPhotoPath) {
              try {
                const response = await fetch(pack.demoPhotoPath);
                if (!response.ok) throw new Error("local demo photo missing");
                const blob = await response.blob();
                photoFile = new File([blob], "local-demo-label.jpeg", {
                  type: blob.type || "image/jpeg",
                });
              } catch {
                window.alert(
                  "The local demo photo is missing. Follow docs/LOCAL_DEMO.md to add it; the photo is intentionally excluded from Git.",
                );
                return;
              }
            }
            // Demo fixtures are preloaded for repeatable recordings; they are
            // not produced by an OCR or vision request.
            loadFixtureDirect(pack.extraction, photoFile);
            setStep("results");
            setDevOpen(false);
            window.scrollTo({ top: 0 });
          })();
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
