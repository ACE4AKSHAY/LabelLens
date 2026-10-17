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
    color: "var(--st-conflict)",
    soft: "var(--st-conflict-bg)",
  },
  possible_conflict: {
    label: "Possible conflict",
    border: "dashed",
    color: "var(--st-possible)",
    soft: "var(--st-possible-bg)",
  },
  unknown: {
    label: "Unknown",
    border: "dotted",
    color: "var(--st-unknown)",
    soft: "var(--st-unknown-bg)",
  },
  no_match_found: {
    label: "No match found",
    border: "solid",
    color: "var(--st-nomatch)",
    soft: "var(--st-nomatch-bg)",
  },
  not_applicable: {
    label: "Not applicable",
    border: "solid",
    color: "var(--st-nomatch)",
    soft: "var(--st-nomatch-bg)",
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
