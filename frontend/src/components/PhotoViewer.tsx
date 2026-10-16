// PhotoViewer: the uploaded photos. Tapping "show on photo" from an evidence
// item focuses that image (scroll + brief highlight). No bounding boxes.

import { useEffect, useRef, useState } from "react";
import type { ImageReading } from "@shared/contracts";
import type { ScanPhoto } from "@state/scanStore";
import { RetakeIcon, TrashIcon } from "./icons";

export function PhotoViewer({
  photos,
  focusIndex,
  readings = [],
  onRetake,
  onRemove,
}: {
  photos: ScanPhoto[];
  focusIndex: number | null;
  readings?: ImageReading[];
  onRetake: (photoId: string) => void;
  onRemove: (photoId: string) => void;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    const position = photos.findIndex(
      (photo, index) => (photo.readingIndex ?? index) === focusIndex,
    );
    const el = position >= 0 ? refs.current[position] : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setHighlight(position);
      const t = window.setTimeout(() => setHighlight(null), 1600);
      return () => window.clearTimeout(t);
    }
  }, [focusIndex, photos]);

  if (photos.length === 0) return null;
  const readingsByIndex = new Map(readings.map((reading) => [reading.index, reading]));

  return (
    <div className="photo-viewer">
      {photos.map((photo, i) => (
        <figure
          key={photo.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`photo-frame ${highlight === i ? "photo-highlight" : ""}`}
        >
          <img src={photo.url} alt={`Uploaded label photo ${i + 1}`} />
          <figcaption className="photo-caption">
            <span>Photo {i + 1}</span>
            <span className="row">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onRetake(photo.id)}
              >
                <RetakeIcon size={15} />
                Retake
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onRemove(photo.id)}
              >
                <TrashIcon size={15} />
                Remove
              </button>
            </span>
          </figcaption>
          <div className="photo-reading">
            <p>
              <strong>Photo reading estimate:</strong>{" "}
              {readingsByIndex.get(photo.readingIndex ?? i)?.quality ??
                "No quality reading returned"}
            </p>
            <p>
              <strong>Note:</strong>{" "}
              {readingsByIndex.get(photo.readingIndex ?? i)?.note ??
                "No note provided"}
            </p>
            <p className="small muted">
              This is an automated estimate, not a calibrated quality or OCR
              accuracy measurement.
            </p>
          </div>
        </figure>
      ))}
    </div>
  );
}
