// Minimal inline icon set. Status icons use distinct SHAPES plus text so
// status is never conveyed by color alone (Section 9 status presentation).

import type { JSX } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function ConflictIcon({ size = 18, className }: IconProps): JSX.Element {
  // Filled octagon with "!"
  return (
    <svg {...base(size)} className={className} stroke="none">
      <path
        d="M8.2 2h7.6L22 8.2v7.6L15.8 22H8.2L2 15.8V8.2L8.2 2z"
        fill="currentColor"
      />
      <line x1="12" y1="7.5" x2="12" y2="13" stroke="var(--surface)" strokeWidth="2.4" />
      <circle cx="12" cy="16.6" r="1.4" fill="var(--surface)" />
    </svg>
  );
}

export function PossibleIcon({ size = 18, className }: IconProps): JSX.Element {
  // Triangle with "!"
  return (
    <svg {...base(size)} className={className} stroke="none">
      <path
        d="M12 2.5 22.5 21h-21L12 2.5z"
        fill="currentColor"
      />
      <line x1="12" y1="9.5" x2="12" y2="15" stroke="var(--surface)" strokeWidth="2.4" />
      <circle cx="12" cy="18" r="1.3" fill="var(--surface)" />
    </svg>
  );
}

export function UnknownIcon({ size = 18, className }: IconProps): JSX.Element {
  // Question-mark circle
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <path
        d="M9.3 9.2a2.8 2.8 0 1 1 3.6 3.4c-.7.3-.9.8-.9 1.6"
        stroke="var(--surface)"
        strokeWidth="2.2"
        fill="none"
      />
      <circle cx="12" cy="17.3" r="1.3" fill="var(--surface)" />
    </svg>
  );
}

export function NoMatchIcon({ size = 18, className }: IconProps): JSX.Element {
  // Neutral outline circle — deliberately NOT a checkmark.
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function CameraIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function UploadIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

export function RetakeIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function EditIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.5 12.5 10 18 19.5 6.5" />
    </svg>
  );
}

export function WarningIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3 22 20H2L12 3z" />
      <line x1="12" y1="9.5" x2="12" y2="14.5" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function InfoIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.6" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
    </svg>
  );
}

export function ZoomIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
      <line x1="10.5" y1="8" x2="10.5" y2="13" />
      <line x1="8" y1="10.5" x2="13" y2="10.5" />
    </svg>
  );
}

export function XIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function MenuIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function FlaskIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" />
      <path d="M8.5 3h7" />
      <line x1="7.5" y1="15" x2="16.5" y2="15" />
    </svg>
  );
}
