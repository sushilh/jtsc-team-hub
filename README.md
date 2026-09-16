# JTSC Team Hub

Development handoff: [shared rules](AGENTS.md) · [change log](CHANGELOG.md) · [verified release checkpoints](RELEASES.md).

A private website combining volunteer check-in, volunteer administration, and the achievement card studio for Jenks Trojan Swim Club.
Upload a swimmer portrait, select an achievement, personalize the details, and
download a high-resolution PNG for Instagram or Facebook. Photos never leave
the user's device.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Product features

- Multiple achievement events: add up to six event/time rows for any qualifier or milestone, remove/undo rows, and export the same ordered results in all four templates and both social sizes. Single-event layouts remain available. Times are optional; a time without an event name blocks export. Captions include all listed events.
- Meet-deck interface with numbered tool tabs, condensed headings, neutral canvas surfaces, and responsive editing controls.
- Meet Day Studio: draggable/resizable text, sessions, photo, logo, QR, and panel blocks; editable dates, ages, warm-ups, and start times
- Three live color themes, layer order controls, hide/delete/duplicate, layout undo/redo, and 1080×1620 PNG poster export
- Global primary-color picker and validated hex input: updates the complete theme palette across the editor and every PNG format; reset or select a preset to restore its colors. Photos, QR images, and explicit per-block overrides are preserved.
- Meet Day social exports: Instagram 4:5, Facebook 1:1, and original 2:3; standard or 2× resolution (up to 2160×3240), with direct high-resolution canvas rendering and no cropping
- Editable meet captions generated from visible, current poster blocks; independent copy buttons and unique IDs keep both studios usable in the same page
- Meet-book PDF/TXT upload, local text extraction, and reviewable session/event suggestions (15 MB / 60 pages; no OCR)
- Optional meet name and calendar date on all achievement designs and captions; time-first Race Result template

Meet books are parsed heuristically in the browser using PDF.js. Review all detected values before importing. Select up to seven sessions and eight events for a single poster; scanned/password-protected PDFs need a readable copy or pasted text. Files are not uploaded to a server. QR codes are uploaded images, not generated from URLs; a square white-margin container avoids stretching, but users must scan the final export to verify the supplied code. Drafts and images are held in memory and reset on page reload. Layout undo/redo covers component edits, not image replacements or theme changes.

- keyboard-accessible tabs for studio, volunteer check-in, and volunteer admin
- `.xls`, `.xlsx`, and `.csv` Job Signup imports with one-click check-in/out, persisted per-meet open/close controls, scoped roster clearing, preserved corrections, same-format `.xls` download, imported-job walk-ins, manual walk-in sessions, hour adjustments, and CSV reports
- Classic, Signature, Race Result, and Finish Line card designs with Instagram 1080×1350 and Facebook 1080×1080 PNG presets
- editable, locally generated captions with separate copy buttons for Instagram and Facebook

- state, sectionals, junior nationals, and national team presets
- editable swimmer, team, event, and achievement text
- portrait and square social formats
- photo zoom and vertical positioning controls
- 1080px PNG export from the browser canvas
- responsive desktop and mobile editing experience

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: production build and regression tests
- `npm run deploy:cloudflare`: build and publish the public `jtsc-team-hub` Worker using the separate Cloudflare configuration. Requires an authenticated Wrangler session. The existing Sites publication is not changed.

The Cloudflare deployment serves `dist/client` as public assets and runs the built server worker for application routes and volunteer APIs. Server modules and hosting metadata are not public assets. Its `ASSETS` binding also serves the versioned browser-asset URLs. Volunteer administration requires the configured admin PIN; public check-in displays only active assigned roster rows and attendance.

## Volunteer data and authentication

The combined Team Hub Worker is the authoritative volunteer backend. `app/api/[...volunteer]/route.ts` passes Cloudflare bindings to `lib/volunteer-service.mjs`, and the `DB` binding points to the `jtsc-volunteer-crew` D1 database. The old Pages demo is not part of the live data path.

Admin access is verified in the Worker. Its signed `jtsc_admin` cookie is host-only, HTTP-only, SameSite=Strict, and expires after twelve hours. Failed PIN attempts are throttled. Mutations reject cross-site browser requests and all API responses are uncached. Clearing persisted data is disabled unless a deployment explicitly enables `ALLOW_DATA_RESET` or `DEMO_MODE`.

Roster replacement is staged: every new row is inserted inactive, then D1 atomically swaps only matching event-date + event-title scopes. A corrected file therefore cannot empty or partially replace the live desk if an insertion fails, and a repeated meet title on another date remains independent. Check-in uses the `America/Chicago` club date and follows the scheduled day by default. In Sessions & jobs, an admin can manually open or close each imported meet, or return it to its schedule; the override is persisted in D1 and closing never prevents an already checked-in volunteer from checking out. `ALLOW_EARLY_CHECKIN=true` remains an optional deployment-wide override for scheduled meets.

Each import also has a scoped **Clear roster** action. It requires an explicit `CLEAR` confirmation and removes only that file's assignments, attendance, earned credit, and meet override; other imports and manual sessions are left alone. The all-data reset remains disabled on production deployments.

The admin accepts TeamUnify Job Signup `.xls`, `.xlsx`, and `.csv` exports up to 5 MB / 2,500 rows. Public volunteer names are normalized so email addresses and phone numbers are never used as display names. Downloaded signup workbooks retain the original twelve columns and apply completed credit in the source format.

Signed-up volunteers continue to use the expected-volunteer list. For a parent who did not sign up, expand **Walk-in volunteer**, type the parent and swimmer names (both may be new), select the meet's job and shift, and check in. Meet-day scheduling and admin open/close controls apply. Walk-ins join **On deck now**, persist in reports and exports, and survive repeat or corrected signup uploads.

Studio photos and captions stay in the browser. Caption drafts are templates based on entered details, not AI-generated claims or automatic social posts. Switching tabs retains the studio draft, but reloading the page clears it. Admin state is remounted when returning to the admin tab to recheck the session.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
