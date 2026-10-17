// PackageFacts: product name, brand, quantity, dates, and batch codes —
// shown only when read from the photo, always labeled as a photo reading,
// never as an externally verified fact (Section 10).

import type { Extraction } from "@shared/contracts";
import { SourceBadge } from "./SourceBadge";
import { ZoomIcon } from "./icons";

const KIND_LABELS: Record<string, string> = {
  product_name: "Product",
  brand: "Brand",
  quantity: "Net quantity",
  manufacture_date: "Manufacture date",
  best_before: "Best before",
  expiry_date: "Expiry date",
  batch_code: "Batch code",
};

export function PackageFacts({
  extraction,
  onFocusPhoto,
}: {
  extraction: Extraction;
  onFocusPhoto: (imageIndex: number | null) => void;
}) {
  const facts = extraction.package_facts;
  if (facts.length === 0) return null;

  return (
    <section className="card" aria-label="Package details">
      <div className="card-heading">
        <h2>On the pack</h2>
        <SourceBadge kind="photo" />
      </div>
      <ul className="package-facts">
        {facts.map((fact, i) => (
          <li key={`${fact.kind}-${i}`} className="package-fact">
            <span className="fact-kind">{KIND_LABELS[fact.kind] ?? fact.kind}</span>
            <span className="fact-value">
              {fact.value_text}
              {fact.review_required && (
                <span className="chip chip-warn" style={{ marginLeft: 8 }}>
                  check this reading
                </span>
              )}
            </span>
            {fact.image_index !== null && (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => onFocusPhoto(fact.image_index)}
              >
                <ZoomIcon size={15} />
                Open photo
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="small muted">
        Read from your photo, as printed. LabelLens doesn't verify dates or
        batch codes anywhere else.
      </p>
    </section>
  );
}
