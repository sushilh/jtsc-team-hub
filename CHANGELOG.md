# Change log

This log starts on September 16, 2026. Earlier work remains traceable through `git log`. Each new entry should say what changed and what was actually checked; `RELEASES.md` is the source for deployed versions.

## Unreleased

### 2026-09-17 — 3D charts and JTSC team records on the state times page

- Redesigned the state-times bar charts as pseudo-3D extruded columns (front/top/side faces, light-from-above shading) with a hover tilt on each card, matching the "3D motion" visual language already used in the Parent Guide. Each bar still encodes its time honestly on the front face — the extrusion is decorative depth at a fixed offset, not a distorted axis.
- Added JTSC's own club records (from a club-provided SCY records workbook — no swimmer names, aggregate bests only, not published on the web) as a dashed reference line across each chart, rather than a sixth bar: a club record is a benchmark to clear, not another qualifying tier, and a line avoids a sixth categorical color (a 3D grouped-bar chart can already show up to 4 qualifying standards for one age; a same-colored 6th bar would have failed the dataviz skill's colorblind-safe validator). Records are SCY-only, so they disappear when SCM/LCM is selected, and include 25-yard sprints the OKS standards don't track for young age groups. Data lives alongside the OKS standards in `lib/state-qualifying-times.mjs`.
- Checked: `npm test` (53 passing, including 5 new — SCY-only gating, blank-cell handling, a two-year-bracket check, and a monotonic sanity sweep across every team-record stroke/gender), `npx tsc --noEmit` (clean), `npm run lint` (clean once the pre-existing `brag-output/**`/`Claude outputs/**` gap is excluded). Manually verified in a local browser at desktop and 390px: the 3D bars, the record line at both a mid-pack and a record-only distance (25 Free, which has no OKS standard at all), and the new legend/table entries. Included in the State Times release commit.

### 2026-09-17 — State qualifying times page

- Added a new page, `/state-times`, where a parent enters an age, gender, stroke, and course to see every 2025-2028 Oklahoma Swimming qualifying standard that applies — grouped small-multiple bar charts (one per event distance, direct-labeled) plus a full data table, sourced from and linking to OKS's five official PDFs (10-Under State, 14-Under State, Regional, 11-Over State (LC), and Senior State). Data lives in a new pure/tested library, `lib/state-qualifying-times.mjs`; relay events are intentionally excluded since the tool answers a personal "what does my own swim need to be" question. A handful of source-PDF typos (comma used for a colon in a clock time) were corrected; two hand-picked chart colors (blue, olive) were added to the site's categorical set and validated colorblind-safe with the dataviz skill's palette validator — documented in `DESIGN.md`.
- Wired into the six-tab hub nav while keeping the standalone `/state-times` route available. The page exposes the age, gender, stroke, and course filters, grouped charts, JTSC SCY record reference lines, and a full data table with source links.
- Checked: `npm test` (53 passing, including the state-times domain coverage), `npx tsc --noEmit` (clean), `npm run lint` (clean once `brag-output/**` and `Claude outputs/**` are excluded, the pre-existing unrelated gap). The final hub workflow was verified in a local browser at 390px: the State Times tab rendered, SCY records appeared, LCM filtering worked, no horizontal overflow occurred, and there were no browser errors.

### 2026-09-16 — Save volunteer-hour exports for later

- Added a "Save export" button next to Export CSV on the Admin Reports tab. It stores the generated hour-ledger CSV in a new D1 table (`ledger_exports`) instead of only downloading it, and lists saved exports with a download link so a prior export is not lost once the browser tab closes. Saved exports are not cleared by the "Clear all data" reset — they are meant to survive a season reset as a standing record; flagging this in case that should instead be included in the reset scope.
- Extracted the CSV-building logic (shared by the download button and the save action) out of `AdminApp.jsx` into a new tested library file, `lib/ledger-export.mjs`, per the "logic in lib, not components" rule.
- Google Drive was considered as an alternate save target but not built — it needs a Google Cloud OAuth app, a consent flow, and stored refresh tokens, which is materially more setup than D1. Deferred until asked for.
- Checked: `npm test` (41 passing, including 2 new `lib/ledger-export.mjs` tests), `npx tsc --noEmit` (clean), `npm run lint` (clean once `brag-output/**` and `Claude outputs/**` are excluded — the pre-existing, unrelated lint gap noted in `STATUS.md`), and a manual local-dev smoke test in the browser: logged into Admin, saved an export, confirmed it listed with correct totals and downloaded correctly, and confirmed the layout at 390px width. `tests/ui/*.py` Playwright suites were not run — none currently cover the Admin Reports tab. Not pushed or deployed.

### 2026-09-16 — Editable Finish Line card

- Added drag-and-resize editing for the Finish Line photo frame and movable text, image, and color-block overlays. Numeric position/size inputs and arrow-key nudges provide non-drag controls; selection chrome stays out of PNG exports.
- Added local image validation/replacement, layer visibility/order/duplicate/remove, Undo for removal and layout reset, and proportional positioning across portrait and square cards. Updated the Finish Line UX contract; no volunteer records or server data are changed.
- Checked: `npm test` (38 passing, including new renderer/geometry coverage), `npx tsc --noEmit`, strict project UI audit (0 findings), DESIGN.md lint (0 errors), and Playwright Finish Line, achievement-preview, and multi-event flows including mobile, image failure recovery, keyboard, both PNG sizes, and preview/export pixel parity. `npm run lint` alone fails because ESLint scans unrelated untracked `brag-output/` vendor files; the full lint command passes with `brag-output/**` and `Claude outputs/**` excluded. Not pushed or deployed.

### 2026-09-16 — Shared change and release tracking

- Added one working agreement for Codex and Claude, a change log, and a release checkpoint record so a future editor can find a tested starting point.
- Documentation-only change. No application behavior or production deployment changed.
- Checked: repository status, current Git history, and the prior production deployment record. Application tests were not rerun for this documentation-only entry.

## Deployed baseline — 2026-09-16

- Finish Line achievement-card template added with square and portrait PNG exports and support for one to six results.
- Small-meet poster layout adjustment and Parent Guide mobile correction were included in the deployed Git history.
- Verified before release: 37 automated tests, lint, typecheck, strict UI audit, and a live mobile browser smoke test that downloaded a Finish Line PNG.
- Commit and Cloudflare version: see `RELEASES.md`.
