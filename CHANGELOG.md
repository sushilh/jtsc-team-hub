# Change log

This log starts on September 16, 2026. Earlier work remains traceable through `git log`. Each new entry should say what changed and what was actually checked; `RELEASES.md` is the source for deployed versions.

## Unreleased

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
