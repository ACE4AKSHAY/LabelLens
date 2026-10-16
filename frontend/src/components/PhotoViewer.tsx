// PhotoViewer: the uploaded photos. Tapping "show on photo" from an evidence
// item focuses that image (scroll + brief highlight). No bounding boxes.

import { useEffect, useRef, useState } from "react";
import type { ScanPhoto } from "@state/scanStore";
import { RetakeIcon, TrashIcon } from "./icons";

export function PhotoViewer({
  photos,
  focusIndex,
  onRetake,
  onRemove,
}: {
  photos: ScanPhoto[];
  focusIndex: number | null;
  onRetake: (photoId: string) => void;
  onRemove: (photoId: string) => void;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    const el = refs.current[focusIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setHighlight(focusIndex);
      const t = window.setTimeout(() => setHighlight(null), 1600);
      return () => window.clearTimeout(t);
    }
  }, [focusIndex]);

  if (photos.length === 0) return null;

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
        </figure>
      ))}
    </div>
  );
}
