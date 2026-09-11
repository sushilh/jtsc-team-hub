# UX Contract

## Product context and business sources

JTSC serves Oklahoma coaches and swim families in English/en-US. Dates are Gregorian date-only values, formatted without timezone shifts. Accessibility target: WCAG 2.2 AA for changed controls.

The user's multi-event request (2026-09-09) authorizes one swimmer/achievement with several results. `README.md` documents browser-local drafts and the shared volunteer backend; `lib/volunteer-proxy.mjs` enforces existing API boundaries. No permission, retention, billing or legal policy changes are part of this feature. The public Cloudflare site and admin sign-in stay as authorized previously.

## Visual contract

See `DESIGN.md`. Existing runtime CSS is the canonical token source. No new framework or component library is introduced.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | EventResultsEditor + shared studio-field CSS | This contract | Live local edit; optional time | Browser validation/focus tests |
| CRUD | EventResultsEditor | User multi-event request | Add/edit/remove/undo; stay in editor | Full list lifecycle browser test |
| Toast | Inline role=status in owning editor; SocialCaptions for captions | Existing studio feedback pattern | Persistent event status; field error | Live-region assertions |
| Scrollbar | app/site-design.css | DESIGN.md | Global baseline, platform forced colors | Computed styles |
| Date | Native date input in CardStudio | Existing date-only helper | Platform-owned popup accepted | Existing date unit tests |
| Select/Listbox | Native select in MeetDayStudio | Existing studio controls | Platform-owned popup accepted | No select added or modified in this feature |

## Event-list flow ledger

| Operation | Trigger | Pending | Success destination/feedback | Failure recovery | Focus |
|---|---|---|---|---|---|
| Add | Add event | Synchronous | Stay, new empty row, status | Disabled at six; reason shown | New event name |
| Edit | Input change | Synchronous | Preview/caption update | Time without name has inline error; values retained | Remains in input |
| Remove | Remove event N | Synchronous | Stay, last removed row retained for Undo | Last row cannot be removed | Next or previous row |
| Undo | Undo remove | Synchronous | Row restored at original position without reverting other edits | Disabled at limit with reason | Restored event name |
| Download | Template PNG button | Existing busy state | Browser download; size/status | Validation disables export; PNG failure keeps inputs | No navigation |

Six is the presentation limit, visible in the editor; additional input is not silently truncated. Event names are free text up to 36 characters and times up to 16, preserving units and formatting as entered. A time is optional; a time without its event name blocks download. Entirely empty rows are excluded. Both event and time remain ordinary text inputs, not numeric conversions. Caption edits remain user's text until Regenerate is chosen.

## Navigation, recovery and data scope

ClubHub retains studio state across tabs. No event data is put in the URL, sent to a server, or persisted on disk. A page-unload warning protects edited event lists; reload otherwise clears local drafts. Removal is reversible locally, not a deletion of a shared record. This feature does not call any volunteer mutation endpoint. Local edits/export work after the app and assets load even when offline; no remote save or retry is represented.

## Verification and migration scope

Run TypeScript, ESLint, npm test, DESIGN.md lint and strict premium audit. Browser tests in `tests/ui/multi-event.py` cover add, edit, error, remove, undo, maximum/empty rows, captions, template switching, portrait/square downloads, keyboard focus, narrow layout, tab retention and offline export. Compare Meet Day's existing inspector and caption flow. This slice changes achievement event controls and standardizes multiline fields through `AutoGrowTextarea`; unrelated admin behavior is not migrated. Static audit scans the app; browser verification is scoped to changed workflows.
