// PhotoCapture (Section 9): camera capture where supported, always with file
// upload; 1–3 photos staged with previews. Before a live upload it discloses
// that the photos go to the configured vision provider, and that the profile
// stays in the browser. It does not promise provider-side deletion.

import { useRef } from "react";
import { useScan } from "@state/scanStore";
import { extractMode } from "@api/extract";
import { CameraIcon, InfoIcon, UploadIcon, XIcon } from "./icons";

const MAX_PHOTOS = 3;
const GEMINI_TERMS_URL = "https://ai.google.dev/gemini-api/terms";
const ZAI_TERMS_URL = "https://docs.z.ai/legal-agreement/terms-of-use";
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function PhotoCapture() {
  const {
    scan,
    addPhotos,
    replacePhoto,
    removePhoto,
    startScan,
    canStartScan,
    dismissError,
  } = useScan();
  const mode = extractMode();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);

  const remaining = MAX_PHOTOS - scan.photos.length;

  const openCamera = (targetId?: string) => {
    if (targetId) {
      replaceTargetId.current = targetId;
      replaceInputRef.current?.click();
    } else {
      replaceTargetId.current = null;
      cameraInputRef.current?.click();
    }
  };

  const onCameraSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (replaceTargetId.current) {
      replacePhoto(replaceTargetId.current, file);
      replaceTargetId.current = null;
    } else {
      addPhotos([file]);
    }
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) addPhotos(files);
  };

  const hasPhotos = scan.photos.length > 0;
  const reading = scan.phase === "reading";

  return (
    <section className="capture" aria-labelledby="capture-title">
      <div className="capture-head">
        <h2 id="capture-title" className="caps">
          Label photos
        </h2>
        <span className="capture-count" aria-label={`${scan.photos.length} of ${MAX_PHOTOS} photos added`}>
          {scan.photos.length} / {MAX_PHOTOS}
        </span>
      </div>

      {scan.error && (
        <div className="note note-error" role="alert">
          <InfoIcon />
          <div>
            <p>
              <strong>Problem</strong>
            </p>
            <p>{scan.error.message}</p>
            {scan.error.requestId && (
              <p className="small error-request-id">
                Request ID: <code>{scan.error.requestId}</code>. See backend/logs/labellens.log.
              </p>
            )}
            <div className="row note-actions">
              {scan.error.retryable && canStartScan && (
                <button type="button" className="btn btn-sm" onClick={() => startScan()}>
                  Try again
                </button>
              )}
              <button type="button" className="btn btn-quiet btn-sm" onClick={dismissError}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="visually-hidden"
        onChange={onCameraSelected}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="visually-hidden"
        onChange={onCameraSelected}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={addInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="visually-hidden"
        onChange={onFilesSelected}
        aria-hidden="true"
        tabIndex={-1}
      />

      {remaining > 0 ? (
        <div className="capture-actions">
          <button
            type="button"
            className={hasPhotos ? "btn" : "btn btn-primary btn-big"}
            onClick={() => openCamera()}
          >
            <CameraIcon size={hasPhotos ? 18 : 22} />
            Take a photo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => addInputRef.current?.click()}
          >
            <UploadIcon />
            Upload {hasPhotos ? "more" : "photos"}
          </button>
        </div>
      ) : (
        <p className="small muted">
          Maximum of {MAX_PHOTOS} photos. Remove or retake one to change it.
        </p>
      )}

      {hasPhotos && (
        <ul className="capture-previews" aria-label="Added photos">
          {scan.photos.map((photo, i) => (
            <li key={photo.id}>
              <figure className="capture-thumb">
                <img src={photo.url} alt={`Label photo ${i + 1}`} />
                <figcaption className="photo-caption">
                  <span>Photo {i + 1}</span>
                  <span className="row">
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => openCamera(photo.id)}
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm btn-icon"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => removePhoto(photo.id)}
                    >
                      <XIcon size={15} />
                    </button>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      <p className="small muted capture-hint">
        One clear photo of the ingredient list is the simplest path. Add the
        nutrition panel or the allergen line as extra photos when they sit on
        different parts of the pack. Hold the pack flat, in even light, close
        enough that the small print is sharp.
      </p>

      {mode === "live" ? (
        <div className="note note-disclosure">
          <InfoIcon />
          <p className="small">
            Before you scan: photos are sent to the vision provider configured
            for this app. If a fallback provider is configured, the same photos
            may be sent there after a retryable failure, which can add API use.
            If Gemini is selected, its current API terms say it is for
            professional or business developer use, not consumer use; confirm
            suitability before making a live version available to shoppers. If
            you use Gemini's unpaid
            service, Google may use submitted content to improve its products,
            and human reviewers may process it. Do not submit sensitive,
            confidential, or personal information. Review the applicable{" "}
            <a href={GEMINI_TERMS_URL} target="_blank" rel="noreferrer">
              Google Gemini API terms
            </a>
            {" "}and{" "}
            <a href={ZAI_TERMS_URL} target="_blank" rel="noreferrer">
              Z.AI terms
            </a>
            . Google says data sent through unpaid Gemini API services may be
            used to improve its products. Your dietary profile stays in this
            browser and is not sent to a provider. LabelLens does not save your
            photos; provider-side retention depends on that provider's terms.
          </p>
        </div>
      ) : (
        <div className="note note-info">
          <InfoIcon />
          <p className="small">
            Mock mode: no photo is sent anywhere. The scan returns a built-in
            sample reading so you can try the whole flow.
          </p>
        </div>
      )}

      <div className="capture-bar">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!canStartScan || reading}
          onClick={() => startScan()}
        >
          {reading
            ? "Reading the label…"
            : `Read ${scan.photos.length > 1 ? `the ${scan.photos.length} photos` : "this photo"}`}
        </button>
        {!hasPhotos && <p className="small muted capture-bar-hint">Add a photo to continue.</p>}
      </div>
    </section>
  );
}
