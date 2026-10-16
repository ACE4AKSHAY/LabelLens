// Scan page — steps 2 and 3 in one workspace. Phone: one column in the order
// summary → result cards → photo → review → couldn't-read, with the photo
// collapsible. Desktop: sticky photo column beside the results workspace.

import { useMemo, useState } from "react";
import { useScan } from "@state/scanStore";
import { useProfile } from "@state/profileStore";
import { PhotoCapture } from "@components/PhotoCapture";
import { PhotoViewer } from "@components/PhotoViewer";
import { CoverageSummary } from "@components/CoverageSummary";
import { ResultsList } from "@components/ResultsList";
import { ConfirmCompleteness } from "@components/ConfirmCompleteness";
import { IngredientTable } from "@components/IngredientTable";
import { AllergenTable } from "@components/AllergenTable";
import { NutritionTable } from "@components/NutritionTable";
import { PackageFacts } from "@components/PackageFacts";
import { CouldntReadPanel } from "@components/CouldntReadPanel";
import { PersistentNote } from "@components/PersistentNote";
import { profileSummary } from "@state/profileStore";
import aliasMapJson from "@domain/aliasMap.json";
import type { AliasMap } from "@domain/compareProfile";
import { InfoIcon } from "@components/icons";
import { collectEditedEvidence } from "@state/applyCorrections";
import { downloadScanCsv } from "@state/scanExport";

const aliasMap = aliasMapJson as unknown as AliasMap;

export function ScanPage({
  onEditProfile,
}: {
  onEditProfile: () => void;
}) {
  const {
    scan,
    hasProfile,
    setConfirm,
    correctRow,
    restoreRow,
    checkRow,
    retakePanel,
    removePhoto,
    goCapture,
    clearScan,
  } = useScan();
  const { profile } = useProfile();
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const editedEvidence = useMemo(
    () =>
      scan.extraction
        ? collectEditedEvidence(scan.extraction, scan.corrections)
        : new Map(),
    [scan.extraction, scan.corrections],
  );

  const capturePhase = scan.phase !== "results";

  return (
    <div className={`page scan-page ${capturePhase ? "scan-capture" : "scan-results"}`}>
      <div className="workspace">
        {/* Photo / capture column */}
        <aside className="ws ws-photo">
          {capturePhase ? (
            <PhotoCapture />
          ) : (
            <details className="card photo-card" open>
              <summary>
                Photos ({scan.photos.length})
                <span className="small muted photo-summary-hint">
                  tap an evidence item's “Show on photo” to find it here
                </span>
              </summary>
              <PhotoViewer
                photos={scan.photos}
                focusIndex={focusIndex}
                readings={scan.extraction?.images}
                onRetake={retakePanel}
                onRemove={removePhoto}
              />
            </details>
          )}
        </aside>

        {capturePhase ? (
          /* Capture-phase guidance column */
          <div className="ws ws-main">
            <section className="card">
              <h2>How this works</h2>
              <ol className="how-list muted">
                <li>Photograph the ingredient list, allergen line, and nutrition panel.</li>
                <li>We read the text exactly as printed and show you what we could and couldn't read.</li>
                <li>You confirm what the whole pack shows and correct any misreads.</li>
                <li>Your profile is compared against the readable text — with the evidence beside it.</li>
              </ol>
              {!hasProfile && (
                <div className="note" role="note">
                  <InfoIcon />
                  <p className="small">
                    <strong>No restrictions selected.</strong> You can still scan a
                    label, but there's nothing to compare it against yet.{" "}
                    <button type="button" className="btn btn-sm" onClick={onEditProfile}>
                      Set up your profile
                    </button>
                  </p>
                </div>
              )}
            </section>
            <section className="card">
              <div className="card-heading">
                <h2>Your profile</h2>
                <button type="button" className="btn btn-sm" onClick={onEditProfile}>
                  Edit
                </button>
              </div>
              <p className="chip chip-accent">{profileSummary(profile)}</p>
            </section>
            <PersistentNote />
          </div>
        ) : (
          <>
            {/* Summary line */}
            <div className="ws ws-summary">
              <CoverageSummary
                results={scan.results!}
                packHasNoAllergenStatement={scan.confirm.pack_has_no_allergen_statement}
              />
              {scan.extraction?.analysis_id === "local-demo-itc-tedhe-medhe" && (
                <div className="note" role="note">
                  <p className="small">
                    <strong>Preloaded demo reading.</strong> These sample
                    results are hardcoded for this photo and were not generated
                    by OCR or a live AI request. Small curved print remains
                    uncertain; check the package directly.
                  </p>
                </div>
              )}
              <div className="scan-export-actions" role="group" aria-label="Export scan results">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!scan.extraction || !scan.results}
                  onClick={() => {
                    if (!scan.extraction || !scan.results) return;
                    downloadScanCsv({
                      extraction: scan.extraction,
                      results: scan.results,
                      confirm: scan.confirm,
                      corrections: scan.corrections,
                      rowChecked: scan.rowChecked,
                      rowRestored: scan.rowRestored,
                    });
                  }}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => window.print()}
                >
                  Print / Save as PDF
                </button>
              </div>
            </div>

            {/* Result cards */}
            <div className="ws ws-results">
              {scan.results ? (
                <ResultsList
                  results={scan.results}
                  editedEvidence={editedEvidence}
                  onFocusPhoto={setFocusIndex}
                />
              ) : (
                <section className="card">
                  <p className="muted">Nothing to show yet.</p>
                </section>
              )}
            </div>

            {/* Review column: confirmations + ingredient review + nutrition + facts */}
            <div className="ws ws-review">
              <ConfirmCompleteness confirm={scan.confirm} onChange={setConfirm} />

              <section className="card" aria-label="Ingredient review">
                <div className="card-heading">
                  <h2>Ingredients</h2>
                  <span className="chip">
                    {scan.extraction?.ingredients.length ?? 0} rows
                  </span>
                </div>
                <p className="small muted" style={{ marginBottom: 12 }}>
                  “As printed” is exactly what the pack says. “Recognized as”
                  appears only when the alias list supports it. Save a correction
                  to rerun the comparison immediately; corrected wording appears
                  separately, and unresolved rows still need an explicit photo
                  check.
                </p>
                {scan.extraction && (
                  <IngredientTable
                    extraction={scan.extraction}
                    aliasMap={aliasMap}
                    corrections={scan.corrections}
                    rowChecked={scan.rowChecked}
                    onCorrect={correctRow}
                    onRestore={restoreRow}
                    onCheckRow={checkRow}
                    onFocusPhoto={setFocusIndex}
                  />
                )}
              </section>

              <section className="card" aria-label="Allergen statement review">
                <div className="card-heading">
                  <h2>Allergen statements</h2>
                </div>
                <p className="small muted" style={{ marginBottom: 12 }}>
                  The photo evidence stays unchanged. Editing a phrase reruns
                  the comparison but does not clear its review flag.
                </p>
                {scan.extraction && (
                  <AllergenTable
                    extraction={scan.extraction}
                    corrections={scan.corrections}
                    rowChecked={scan.rowChecked}
                    onCorrect={correctRow}
                    onRestore={restoreRow}
                    onCheckRow={checkRow}
                    onFocusPhoto={setFocusIndex}
                  />
                )}
              </section>

              <section className="card" aria-label="Nutrition">
                <div className="card-heading">
                  <h2>Nutrition</h2>
                </div>
                {scan.extraction && <NutritionTable extraction={scan.extraction} onFocusPhoto={setFocusIndex} />}
              </section>

              {scan.extraction && (
                <PackageFacts extraction={scan.extraction} onFocusPhoto={setFocusIndex} />
              )}

              {scan.extraction && (
                <CouldntReadPanel
                  extraction={scan.extraction}
                  onRetakePrompt={goCapture}
                />
              )}

              <section className="card actions-card">
                <div className="row spread">
                  <button type="button" className="btn" onClick={goCapture}>
                    Back to photos
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={clearScan}>
                    Clear scan and start over
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={onEditProfile}>
                    Edit profile
                  </button>
                </div>
              </section>

              <PersistentNote />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
