// Persistent copy (Section 9): always visible, never implies safety.

export function PersistentNote({ compact }: { compact?: boolean }) {
  return (
    <p className={`persistent-note ${compact ? "small" : ""}`}>
      LabelLens reads label text. It can't confirm a product is safe. Check the
      pack yourself.
    </p>
  );
}
