# JTSC Team Hub — repository guide

Claude Code reads this file automatically at startup. It describes **what this
codebase is and how it is built**. The rules for *how to work in it* — commits,
changelog, releases, handoffs — live in [AGENTS.md](AGENTS.md) and apply to
every agent equally. Read AGENTS.md before changing anything.

Coordination between assistants runs through [STATUS.md](STATUS.md). Read it
first, claim what you are taking, and update it when you stop.

---

## What this is

One web app that runs a swim club's season for Jenks Trojan Swim Club:
volunteer check-in at a meet, meet-day poster and achievement-card studios,
admin reporting, and a new-parent guide.

Production: <https://jtsc-team-hub.sushilh.workers.dev/>

The five tabs on the hub are peers: **Meet Day Studio · Achievement Cards ·
Volunteer Check-in · Admin · Parent Guide**.

## Stack

| Piece | Version / choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, running through `vinext` on Cloudflare Workers |
| Language | TypeScript 5.9 (`strict`); some client components are still `.jsx` |
| Styling | Tailwind CSS 4.2 is imported, but the UI is hand-authored CSS (see below) |
| Data | Cloudflare D1 (`DB` binding, database `jtsc-volunteer-crew`) |
| Spreadsheets | SheetJS (`xlsx`) for the GoMotion "Job Signup" import and export |
| Runtime config | `wrangler.cloudflare.jsonc` (deploy), `wrangler.dev.jsonc` (local) |
| Node | >= 22.13 |

## Architecture — four layers

Changes belong in the lowest layer that can hold them. Do not let a layer reach
past the one below it.

1. **Routes** — `app/*/page.tsx`, `app/api/[...volunteer]/route.ts`.
   Server components and the single API entry point. The API route is thin: it
   takes the Cloudflare `env` and hands the request to the service layer.
2. **Client experiences** — `app/components/*`.
   `ClubHub` owns the five tabs; `VolunteerApp`, `AdminApp`, `MeetDayStudio`,
   `CardStudio`, `ParentGuide` own their tab. These hold UI state and call the
   API. They contain no domain math.
3. **Domain and rendering libraries** — `lib/*.ts`, `lib/*.mjs`.
   Pure, testable, no DOM and no network: `job-signup.mjs` (the 13-column
   workbook contract), `volunteer-jobs.mjs` (the 35-job catalog and credited
   hours), `meet-day.ts` / `meet-renderer.ts` / `meet-colors.ts` (poster model
   and canvas painter), `finish-line-card.ts` / `multi-event-card.ts` /
   `achievement-events.ts` (card geometry). New logic starts here, with a test.
4. **Service and data** — `lib/volunteer-service.mjs`.
   Every D1 table, migration statement, auth check, rate limit and mutation.
   It is the only file that talks to the database. `lib/volunteer-proxy.mjs` is
   the legacy passthrough to the old Pages service and is kept for its tests;
   live traffic goes through `volunteer-service.mjs`.

### The one thing that causes wrong numbers

Volunteer work arrives on **two independent paths** and both are real:

- `signup_rows` — people who signed up in GoMotion, imported from the workbook.
- `volunteer_entries` — walk-ins checked in at the desk with no signup row.

**Any count, ledger, report or overview must sum both tables.** Every "the
numbers never change" bug in this repo has been a query that read only one.
`checked_in_at IS NOT NULL` is what distinguishes a desk check-in from a row
that arrived already completed in the file.

## Styling conventions

This is **not** a utility-first Tailwind codebase, and it should not become one
by accident.

- `app/globals.css` starts with `@import "tailwindcss";` so utilities are
  available, but there is **no `@theme` block** and no generated design tokens.
  Do not add one without agreement — `DESIGN.md` records "Token ownership is
  Model B: existing runtime CSS is canonical."
- The real tokens are CSS custom properties on `:root` in
  `app/site-design.css`: `--maroon #741b38`, `--maroon-dark #501327`,
  `--maroon-soft #f5edef`, `--paper #f7f7f5`, `--ink #202223`,
  `--muted #606366`, `--line #d8d9d6`, `--gold #c9963a`, `--aqua #4db6a0`,
  `--dark #1a0a12`, plus the `--glass-*` set.
- Fonts come from `app/layout.tsx` via `next/font/google`:
  Space Grotesk on `--font-display`, DM Sans on `--font-body`.
- Three stylesheets, by scope: `globals.css` (Meet Day Studio),
  `site-design.css` (hub shell, tabs, volunteer and admin surfaces, parent
  guide), `achievement-design.css` (card studio).
- Canvas output (posters, achievement cards) has its **own** palettes in
  `lib/meet-day.ts`, `lib/meet-colors.ts` and `CardStudio.tsx`. A poster color
  is not a site theme token; keep them separate.
- `DESIGN.md` is the design contract and `UX-CONTRACT.md` is the behavior
  contract. If a change alters either, update that file in the same commit.

## Security and data constraints

- **Never commit secrets.** `.dev.vars` holds `ADMIN_PIN` and `DEMO_MODE` and
  is gitignored. Production secrets live in Cloudflare, set with
  `wrangler secret put`.
- **Admin auth fails closed.** If `ADMIN_PIN` is unset the service returns 503,
  it does not fall through to an open admin. Keep it that way. Login is
  throttled (8 failures / 15 minutes) and the session cookie is `jtsc_admin`.
- **Never commit real swimmer or volunteer data.** Signup workbooks, exports
  and screenshots with names go in `test-signup-files/` (gitignored) or stay
  off the repo. `lib/achievement-members.json` is the only member list in the
  tree; do not expand it with new personal data.
- **Mutations are POST-only and same-origin checked.** Keep the `Origin` /
  `Sec-Fetch-Site` guard in `volunteer-service.mjs` on every mutating action.
- **Destructive actions stay explicit.** Reset/clear-all wipes every volunteer
  table. It must remain gated and clearly labeled; do not widen who can call it
  or make it reachable without an intentional press.
- Upload limits (5 MB, 2500 rows) exist to protect the Worker. Do not raise
  them to make a file parse.
- A `stable/*` tag is a **code** checkpoint. It does not back up D1. Never roll
  back volunteer data without asking.

## Commands

```bash
npm run dev                # local dev on the Workers runtime
npm test                   # builds, then runs node --test tests/*.test.mjs
npx tsc --noEmit           # typecheck
npm run lint               # eslint
npm run build              # vinext build -> dist/
npm run deploy:cloudflare  # build + wrangler deploy (only when asked)
```

Browser checks live in `tests/ui/*.py` (Playwright). `volunteer-live-day.py`
covers the meet-day flow end to end; `multi-event.py` and `finish-editor.py`
cover the card studios. Run the ones for the path you changed, and check one
nearby workflow at 390px before calling UI work done.

## Gotchas worth knowing before you debug

- `AdminApp.jsx` and `VolunteerApp.jsx` are `.jsx`, so `tsc --noEmit` does
  **not** check them. A reference error in those files only shows up at
  runtime. Open the tab in a browser after editing them.
- Optional chaining does not rescue an undeclared variable: `data?.foo` still
  throws if `data` was never declared in that scope. Thread props explicitly.
- Guide section anchors are prefixed `guide-` on purpose. A bare `#meet-day`
  collides with the Meet Day tab id and hijacks navigation.
- `.club-hub { overflow-x: clip; }` exists because a `translateX` entrance
  animation widened the document at every width. Check page overflow after
  adding transforms.
- Run `npm install` from the **repository root only**. Running it inside a
  subfolder walks up and rewrites the root `package.json` and lockfile.
- `event.currentTarget` is null after an `await` in a React handler. Capture
  the element before the await.
- "Not overlapping" is not the same as "looks designed" — for poster and card
  layout changes, render a real frame and look at it.
