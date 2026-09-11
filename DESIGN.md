---
version: alpha
name: JTSC Team Hub
description: A meet-deck workspace for team communications and volunteer coordination.
colors:
  primary: "#741b38"
  background: "#f7f7f5"
  ink: "#202223"
  muted: "#606366"
  line: "#d8d9d6"
typography:
  body:
    fontFamily: "Archivo, Arial, sans-serif"
  display:
    fontFamily: "Archivo Narrow, Arial, sans-serif"
rounded:
  control: "2px"
spacing:
  rail: "360px"
  workspace-gap: "28px"
omitted:
  - section: components
    reason: Component recipes remain in the established CSS and are mapped in prose below.
---

# JTSC Design System

## Overview

The North Star is a Jenks Trojan meet-deck work desk, not a promotional landing page. Coaches and parent volunteers create swimmer and meet communications on desktop and phones. The audience is the Oklahoma swim club; English/en-US is the current UI language. Japan-market behavior is not in scope.

The existing numbered navigation and restrained maroon/white/black palette are preserved. Event rows use real ordinal positions in the result list, not decorative badges. Keep the swimmer photo separate from results.

Token ownership is Model B: existing runtime CSS is canonical; this file records accepted values without generating a second theme.

## Colors

`app/site-design.css :root` owns the primary, background, ink, muted and line tokens above. The achievement canvas intentionally uses its existing template palette in `CardStudio.tsx` and `lib/multi-event-card.ts`; Meet Day palettes have their own `lib/meet-day.ts` and `lib/meet-colors.ts` owners. A poster color is not a website theme token. Keep an explicit text label on errors; color alone is insufficient.

## Typography

`app/layout.tsx` provides Archivo for `--font-body` and Archivo Narrow for `--font-display`. New event controls use 16px input text and 14px labels/buttons; secondary instructions use 13px. Card canvas typography uses Arial Narrow/Arial intentionally to retain its existing export appearance. Multi-event names and times have separate width budgets and fit at export resolution.

## Layout

The editing rail is 360px with a 28px gap on desktop; the existing 800px breakpoint stacks the controls and preview. Forms remain in document flow. One to six event rows are rendered in order. Empty rows are omitted from graphics. Single-event exports retain their original layout; multiple-event exports reserve a photo region above a results panel, with no text over the photo at default zoom.

## Elevation & Depth

The workspace uses borders and neutral canvas surfaces, with a small shadow only around the output. Signature export retains its glass-like maroon treatment; Classic uses white and Race Result uses dark/maroon with gold accents. Do not put gradients on editor controls.

## Shapes

Controls retain the existing 2px radius. Output templates may have their own radii. Event rows use dividing rules, not independent rounded cards.

## Components

Runtime mapping: colors.primary → `--maroon` → event action colors; colors.line → `--line` → event dividers; colors.muted → `--muted` → help text. Typography flows from layout font variables to shared `.studio-field` styles. `EventResultsEditor` is the owner of event list controls. `SocialCaptions` owns caption editing, copy and regeneration. See `UX-CONTRACT.md` for state transitions.

Event actions are native buttons with hover, active, focus-visible and disabled states. Remove has a plain-text label; Undo restores the last removed row. No modal is needed for this recoverable local edit. Native inputs retain label activation and keyboard behavior. Date/select popups elsewhere remain platform-owned; the event editor introduces neither.

The global scrollbar baseline is in `app/site-design.css`, using `--scroll-thumb`, `--scroll-track`, `--scroll-hover`, and `--scroll-active`. All document-owned scroll surfaces inherit it; forced colors use the platform palette. No new animation is introduced; existing reduced-motion rules remain.

## Do's and Don'ts

- Do preserve names, event order and times across template and tab changes.
- Do use a shared data list for preview, export and captions.
- Don't infer qualification standards, convert entered times or silently drop excess results.
- Don't replace the established site identity for this feature.

`AutoGrowTextarea` now owns caption and meet-editor multiline fields: grow to 560px, then scroll with a visible scrollbar. This resolves previous inconsistent manual-resize behavior without changing text or navigation. Legacy admin fields outside this feature predate this contract and are not evidence of new approved patterns.
