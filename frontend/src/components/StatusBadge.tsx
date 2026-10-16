// Status presentation (Section 9): label text + icon shape + border pattern.
// Colors are supplementary. "No match found" is a neutral outline circle —
// never a checkmark — and always carries "in readable label text" nearby.

import type { ResultStatus } from "@shared/contracts";
import { ConflictIcon, NoMatchIcon, PossibleIcon, UnknownIcon } from "./icons";

export const STATUS_META: Record<
  ResultStatus,
  {
    label: string;
    border: string; // border-style token
    color: string; // CSS var
    soft: string; // CSS var
  }
> = {
  conflict: {
    label: "Conflict",
    border: "solid",
    color: "var(--status-conflict)",
    soft: "var(--status-conflict-soft)",
  },
  possible_conflict: {
    label: "Possible conflict",
    border: "dashed",
    color: "var(--status-possible)",
    soft: "var(--status-possible-soft)",
  },
  unknown: {
    label: "Unknown",
    border: "dotted",
    color: "var(--status-unknown)",
    soft: "var(--status-unknown-soft)",
  },
  no_match_found: {
    label: "No match found",
    border: "solid",
    color: "var(--status-nomatch)",
    soft: "var(--status-nomatch-soft)",
  },
  not_applicable: {
    label: "Not applicable",
    border: "solid",
    color: "var(--status-nomatch)",
    soft: "var(--status-nomatch-soft)",
  },
};

function StatusGlyph({ status }: { status: ResultStatus }) {
  switch (status) {
    case "conflict":
      return <ConflictIcon />;
    case "possible_conflict":
      return <PossibleIcon />;
    case "unknown":
      return <UnknownIcon />;
    default:
      return <NoMatchIcon />;
  }
}

export function StatusBadge({ status }: { status: ResultStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="status-badge"
      style={{
        color: meta.color,
        background: meta.soft,
        borderStyle: meta.border,
        borderColor: meta.color,
      }}
    >
      <StatusGlyph status={status} />
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusIconOnly({ status }: { status: ResultStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="status-icon" style={{ color: meta.color }}>
      <StatusGlyph status={status} />
      <span className="visually-hidden">{meta.label}</span>
    </span>
  );
}
