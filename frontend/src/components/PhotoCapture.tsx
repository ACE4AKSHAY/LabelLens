// PhotoCapture (Section 9): camera capture where supported, always with file
// upload; 1–3 photos staged with previews. Before a live upload it discloses
// that photos go to the configured external vision provider. It does not
// promise provider-side deletion.

import { useRef } from "react";
import { useScan } from "@state/scanStore";
import { extractMode } from "@api/extract";
import { CameraIcon, UploadIcon, XIcon } from "./icons";

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

  return (
    <section className="card capture-card" aria-label="Label photos">
      <div className="card-heading">
        <h2>Label photos</h2>
        <span className="chip">
          {scan.photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {scan.error && (
        <div className="note note-error" role="alert">
          <div>
            <p>{scan.error.message}</p>
            {scan.error.requestId && (
              <p className="small error-request-id">
                Request ID: <code>{scan.error.requestId}</code>. Backend details: <code>backend/logs/labellens.log</code>
              </p>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              {scan.error.retryable && scan.photos.length > 0 && (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void startScan()}>
                  Retry scan
                </button>
              )}
              <button type="button" className="btn btn-sm" onClick={dismissError}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {scan.photos.length > 0 && (
        <div className="capture-previews">
          {scan.photos.map((photo, i) => (
            <figure key={photo.id} className="capture-thumb">
              <img src={photo.url} alt={`Label photo ${i + 1}`} />
              <figcaption className="photo-caption">
                <span className="small">Photo {i + 1}</span>
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
                    className="btn btn-quiet btn-sm"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => removePhoto(photo.id)}
                  >
                    <XIcon size={15} />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
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

      {remaining > 0 && (
        <div className="capture-actions">
          <button type="button" className="btn" onClick={() => openCamera()}>
            <CameraIcon />
            Take a photo
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => addInputRef.current?.click()}
          >
            <UploadIcon />
            Upload {scan.photos.length > 0 ? "more" : "photos"}
          </button>
        </div>
      )}
      {remaining <= 0 && (
        <p className="small muted">
          Maximum of {MAX_PHOTOS} photos — remove or retake one to change it.
        </p>
      )}

      <p className="small muted capture-hint">
        One clear photo of the ingredient list is the simplest path. Add the
        nutrition panel or the allergen line as extra photos when they sit on
        different parts of the pack. Hold the pack flat, in even light, close
        enough that the small print is sharp.
      </p>

      {mode === "live" ? (
        <div className="note note-disclosure">
          <p className="small">
            Before you scan: the photos you upload are sent to the configured
            external vision provider to be read. If GLM via Z.AI is selected
            and cannot complete the request, the backend may send the same
            photos to Google Gemini as a fallback.
            Review the applicable{" "}
            <a href={GEMINI_TERMS_URL} target="_blank" rel="noreferrer">
              Google Gemini API terms
            </a>
            {" "}or{" "}
            <a href={ZAI_TERMS_URL} target="_blank" rel="noreferrer">
              Z.AI terms
            </a>
            . Your dietary profile never leaves this browser, and LabelLens
            itself does not save your photos.
          </p>
        </div>
      ) : (
        <div className="note note-info">
          <p className="small">
            Mock mode: no photo is sent anywhere. The scan returns a built-in
            sample reading so you can try the whole flow.
          </p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!canStartScan || scan.phase === "reading"}
        onClick={() => startScan()}
      >
        {scan.phase === "reading"
          ? "Reading the label…"
          : `Read ${scan.photos.length > 1 ? `the ${scan.photos.length} photos` : "this photo"}`}
      </button>
      {scan.photos.length === 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Add a photo to continue.
        </p>
      )}
    </section>
  );
}
