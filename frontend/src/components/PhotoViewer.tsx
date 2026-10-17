// PhotoViewer: choose among the uploaded photos. Evidence links select the
// corresponding full photo and outline its frame briefly; there are no text
// coordinates, so the image is never presented as an exact highlight.

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(selectedIndex, Math.max(0, photos.length - 1));
  const selectedPhoto = photos[safeIndex];
  const readingsByIndex = new Map(readings.map((reading) => [reading.index, reading]));

  useEffect(() => {
    if (focusIndex === null) return;
    const position = photos.findIndex(
      (photo, index) => (photo.readingIndex ?? index) === focusIndex,
    );
    if (position < 0) return;

    setSelectedIndex(position);
    setHighlight(true);
    viewerRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
    const timeout = window.setTimeout(() => setHighlight(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [focusIndex, photos]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, photos.length - 1)));
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <div className="photo-viewer" ref={viewerRef}>
      <div className="photo-thumbnails" role="group" aria-label="Choose a label photo">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="photo-thumb"
            aria-label={`Show photo ${index + 1}`}
            aria-pressed={safeIndex === index}
            onClick={() => setSelectedIndex(index)}
          >
            <img src={photo.url} alt="" />
            <span>Photo {index + 1}</span>
          </button>
        ))}
      </div>

      {selectedPhoto && (
        <figure
          key={selectedPhoto.id}
          className={`photo-frame ${highlight ? "photo-highlight" : ""}`}
        >
          <img src={selectedPhoto.url} alt={`Uploaded label photo ${safeIndex + 1}`} />
          <figcaption className="photo-caption">
            <span>Photo {safeIndex + 1} of {photos.length}</span>
            <span className="row">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onRetake(selectedPhoto.id)}
              >
                <RetakeIcon size={15} />
                Retake
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onRemove(selectedPhoto.id)}
              >
                <TrashIcon size={15} />
                Remove
              </button>
            </span>
          </figcaption>
          <div className="photo-reading">
            <p>
              <strong>Photo reading estimate:</strong>{" "}
              {readingsByIndex.get(selectedPhoto.readingIndex ?? safeIndex)?.quality ??
                "No quality reading returned"}
            </p>
            <p>
              <strong>Note:</strong>{" "}
              {readingsByIndex.get(selectedPhoto.readingIndex ?? safeIndex)?.note ??
                "No note provided"}
            </p>
            <p className="small muted">
              This is an estimate, not a calibrated quality or OCR
              accuracy measurement.
            </p>
          </div>
        </figure>
      )}
    </div>
  );
}
