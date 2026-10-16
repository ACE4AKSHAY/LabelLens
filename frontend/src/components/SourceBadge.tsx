// Source badges (Section 9): where a shown fact came from. Catalog exists so
// the "From catalog — not your photo" state has its exact wording.

export type SourceKind =
  | "photo"
  | "edited"
  | "confirmed"
  | "unresolved"
  | "catalog";

const META: Record<SourceKind, { label: string; cls: string }> = {
  photo: { label: "From your photo", cls: "source-badge--photo" },
  edited: { label: "Edited by you", cls: "source-badge--edited" },
  confirmed: { label: "Confirmed against photo", cls: "source-badge--confirmed" },
  unresolved: { label: "Needs review", cls: "source-badge--unresolved" },
  catalog: { label: "From catalog — not your photo", cls: "source-badge--catalog" },
};

export function SourceBadge({
  kind,
  className,
}: {
  kind: SourceKind;
  className?: string;
}) {
  const meta = META[kind];
  return (
    <span className={`source-badge ${meta.cls} ${className ?? ""}`}>
      {meta.label}
    </span>
  );
}
