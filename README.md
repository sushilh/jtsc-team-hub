# JTSC Team Hub

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

- Meet Day Studio: draggable/resizable text, sessions, photo, logo, QR, and panel blocks; editable dates, ages, warm-ups, and start times
- Three live color themes, layer order controls, hide/delete/duplicate, layout undo/redo, and 1080×1620 PNG poster export
- Meet Day social exports: Instagram 4:5, Facebook 1:1, and original 2:3; standard or 2× resolution (up to 2160×3240), with direct high-resolution canvas rendering and no cropping
- Editable meet captions generated from visible, current poster blocks; independent copy buttons and unique IDs keep both studios usable in the same page
- Meet-book PDF/TXT upload, local text extraction, and reviewable session/event suggestions (15 MB / 60 pages; no OCR)
- Optional meet name and calendar date on all achievement designs and captions; time-first Race Result template

Meet books are parsed heuristically in the browser using PDF.js. Review all detected values before importing. Select up to seven sessions and eight events for a single poster; scanned/password-protected PDFs need a readable copy or pasted text. Files are not uploaded to a server. QR codes are uploaded images, not generated from URLs; a square white-margin container avoids stretching, but users must scan the final export to verify the supplied code. Drafts and images are held in memory and reset on page reload. Layout undo/redo covers component edits, not image replacements or theme changes.

- keyboard-accessible tabs for studio, volunteer check-in, and volunteer admin
- existing sessions, roster, check-ins, hour adjustments, and CSV reports
- Classic and Signature card designs with Instagram 1080×1350 and Facebook 1080×1080 PNG presets
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

## Volunteer data and authentication

The original `https://jtsc-volunteer-crew.pages.dev` Cloudflare service remains the authoritative volunteer backend. The restored volunteer components were recovered from its retained production bundle. The combined website proxies only five allowlisted API endpoints to that service; it does not duplicate or migrate the D1 database. Keep the original service running. Updates from either website use the same records.

Admin access is verified by the original service. Only its `jtsc_admin` cookie is forwarded; Sites cookies and authorization credentials are never forwarded. Mutations reject cross-site browser requests and all API responses are uncached. The combined site's current private audience is unchanged.

Studio photos and captions stay in the browser. Caption drafts are templates based on entered details, not AI-generated claims or automatic social posts. Switching tabs retains the studio draft, but reloading the page clears it. Admin state is remounted when returning to the admin tab to recheck the session.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
