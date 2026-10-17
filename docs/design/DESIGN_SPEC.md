# LabelLens redesign: DESIGN_SPEC ("Printed Label" + "Aisle View")
Visual contract: `docs/design/preview.html` (phone frames at 360 px, key states, status key). When this file and the preview disagree, the preview wins.

## Direction
Warm paper, dark ink, one accent. Label wording is set like print (mono, verbatim). Ingredients and nutrition are compact ruled ledger rows. Mobile first from 360 px; primary actions in a bottom bar reachable by thumb. Desktop gets two columns, photo beside evidence.
Accent is indigo `#34379a` (not green/red/amber, so it never reads as a safety signal; 9:1 on paper). Used only for primary buttons, focus, links, step current.

## Tokens (names match preview `:root`)
- Paper: `--paper #f5f0e4` page, `--paper-2 #ece5d3` wells, `--sheet #fbf8f0` raised surface, `--rule #d6ccb4`, `--rule-strong #a39a80`
- Ink: `--ink #1c1a16`, `--ink-2 #47433a`, `--ink-3 #645f50` (AA on paper, minimum for body text)
- Accent: `--accent #34379a`, `--accent-hover #272a7e`, `--accent-soft #e3e2f2`, `--on-accent #fff`, `--focus` = accent
- Status (each: text colour + soft bg): conflict `#a52a16/#f6e0da`, possible `#7a4e00/#f6e8c8`, unknown `#3d4858/#e4e7ec`, no-match `#55564e/#ece8dc`. No green anywhere.
- Space: 4 / 8 / 12 / 16 / 24 / 32 / 48 (`--s1..s7`). Radius: 3 (quotes, chips), 8 (controls), 14 (sheets). `--tap 44px`.
- Fonts (system stacks only): serif (Iowan/Palatino/Georgia) for headings, sans (system-ui) for UI, mono (ui-monospace) for verbatim label text.
- Type scale: 13 small-caps labels (letter-spacing .06em), 14 meta, 15 body/UI, 17 section, 18 card title, 24 page title (serif). Tabular figures on all numbers. Dark mode follows `prefers-color-scheme`, same tokens remapped.

## Components
- **Status badge**: pill with 14 px icon + text, border in status colour, soft bg. Shapes differ: conflict filled square, possible triangle, unknown question circle, no-match dash circle. Text is always present.
- **Evidence quote**: mono text on `--sheet`, 3 px left rule, caption row "Photographed wordingFrom your photo, Photo N" above, "Read as **normalized** (alias/exact), section" below. Both always together.
- **Result card**: one flat sheet with a hairline rule, title + badge on one row, reason sentence, then 1+ evidence quotes. No nested cards.
- **Ledger row**: ruled table row; printed wording first, "Read as" below it; state chips (Edited by you, Needs review, Conflict) trailing. Dash = no value, never zero.
- **Source badge**: "From your photo" (ink outline) vs "From catalog, not your photo" (dashed outline, separate panel, never feeds results).
- **Buttons**: primary (accent fill), secondary (ink outline), text. Min 44 px, 15 px label, visible 3 px focus ring offset 2.
- **Forms**: 44 px checkbox/radio rows with real labels, sheet bg, rule border; helper text 14 px.
- **Notices**: left-ruled blocks with icon + text (info, error with retry). Persistent note "LabelLens reads label text. It can't confirm a product is safe." at the foot of every screen.
- **Step strip**: 3 numbered steps, current = accent fill + `aria-current`.

## Layout
- <760 px: single column, 16 px gutters, sticky bottom action bar (primary action, plus "Scan next" on results), photo reachable via a "Photos" button.
- >=760 px: max width ~1120, two columns on results (photo sticky left ~40%, evidence right); profile and upload stay one centred column (~640).
- Motion 100-200 ms on colour/opacity only; none under `prefers-reduced-motion`.
- Photo view has no overlays: the data has no coordinates, so never imply highlighting.

## Milestones
M0 Preview + spec (DONE), M1 tokens/base, M2 shell/step strip/breakpoints, M3 profile, M4 upload/reading/error, M5 results (summary, cards, badges, quotes, source, couldn't-read), M6 ledgers/allergens/package facts/correction/print, M7 photo viewer + desktop two-column, M8 polish and dead-CSS cleanup.
