# Brand

The name is always written exactly **`the-daily.studio`** (lower case, with the hyphen and the dot). Tagline: **Write. Play. Create.**

## The mark

A hexagon drawn as a cube. The Y inside is the cube's edges; **T**, **D** and **S** sit on its three faces; a small waveform stands on the foot of the cube, mirrored around the stem so the mark stays balanced. The letters are drawn as strokes, so the mark looks identical on every device.

| File | Use |
| --- | --- |
| `icons/mark-dark.svg`, `docs/brand/mark-dark.svg` | On dark backgrounds (sage and paper) |
| `icons/mark-light.svg`, `docs/brand/mark-light.svg` | On light backgrounds (deep green and charcoal) |
| `icons/favicon.svg` | Browser tab; heavier strokes, no waveform, switches with light / dark |
| `icons/icon.svg` and the PNGs beside it | App icon, maskable icon, Apple touch icon |
| `icons/social-card.png` | Link previews (1200 × 630) |
| `docs/brand/brand-sheet.png` | Overview of all of the above |

Inside the app the mark is drawn with the current accent and text colours, so it follows your appearance choices. Keep clear space around it of at least the height of the T. Do not stretch it or put it on a busy background.

The geometry lives in `scripts/brand-mark.mjs`. Edit it, then run `node scripts/make-brand.mjs` to regenerate every file, and `node scripts/build.mjs` to rebuild the app.

## Colour

| Name | Hex | Role |
| --- | --- | --- |
| Sage | `#7DBF9B` | Accent on dark; the mark on dark |
| Deep green | `#264238` | The mark on light; deep surfaces |
| Charcoal | `#0D0F10` | Dark background; text on light |
| Paper | `#E8E8E6` | Light background; text on dark |
| Gold | `#D4A25A` | Secondary highlight and chart colour |

The two default palettes, **Daily Light** and **Daily Night**, are built from these (light mode uses a deeper sage, `#2F7A58`, so text and controls meet WCAG AA contrast). Both are checked with axe. All other palettes, accents and options in the Appearance drawer remain available.

## Type

Headings and the wordmark: **Montserrat** (SemiBold / Bold). Text: **Inter** (Regular / Medium). Both are built into the page under the SIL Open Font License (see `THIRD_PARTY_NOTICES.md`). Small labels use Montserrat in capitals with wide letter-spacing.

## Voice

Plain, warm and unhurried. Sound first, tools that inspire rather than get in the way, everything stays on your device.
