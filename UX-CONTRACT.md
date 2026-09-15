# UX Contract

## Product context and business sources

JTSC serves Oklahoma coaches and swim families in English/en-US. Dates are Gregorian date-only values, formatted without timezone shifts. Accessibility target: WCAG 2.2 AA for changed controls.

The user's multi-event request (2026-09-09) authorizes one swimmer/achievement with several results. The volunteer requirements supplied through 2026-09-15 authorize imported Job Signup rosters, one-click meet-day check-in/out, admin-managed walk-in sessions, persisted credit, and same-format spreadsheet export. `README.md` documents browser-local studio drafts and the Cloudflare D1 volunteer backend; `lib/volunteer-service.mjs` owns the volunteer API and permission boundary. No billing or legal policy changes are part of this work.

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
| Navigation | ClubHub route-backed tabs | This contract | Five peer tools; horizontally scrollable on narrow screens | Keyboard and narrow-width route checks |
| Volunteer roster upload | SignupImportPanel + `lib/job-signup.mjs` | User-provided TeamUnify export | `.xls`, `.xlsx`, `.csv`; one file per action | Real workbook, duplicate, interrupted activation, export |
| Volunteer mutations | VolunteerApp `postCheckin` + service API | User meet-day requirements | Imported assignment or walk-in | Success, conflict, lost-response reconciliation |
| Admin authentication | AdminApp login + signed host-only cookie | Existing authorized admin portal | PIN with throttled failures | Reveal control, invalid PIN, throttle, session restore |

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

The New Parent Information Guide is a read-only peer tab with the stable `parents` hash and a bookmarkable `/parent-guide` route. It is transcribed and reorganized from the four club handout photographs supplied on September 14, 2026. Internal guide links use section anchors; external team-store, GoMotion, email, and telephone links retain native browser navigation. Selecting another Team Hub tab keeps the established in-page tab behavior.

## Volunteer meet-day flow ledger

| Operation | Trigger | Pending | Success destination/feedback | Failure recovery | Focus |
|---|---|---|---|---|---|
| Import roster | Admin chooses one signup file and imports | One stable busy button; duplicate submissions blocked | Stay in Sessions & jobs; assigned/open counts and preserved check-ins reported | New rows stay inactive until every insert succeeds; an interrupted completed upload resumes activation | File picker area |
| Open/close imported meet | Admin selects Open check-in, Close check-in, or Use schedule | Selected meet action reads Saving; all meet-control mutations disabled | Stay in Sessions & jobs; persisted status and public desk refresh | Server keeps prior mode on failure; persistent panel feedback allows retry | Same meet control |
| Clear imported roster | Admin selects Clear roster for one file and confirms `CLEAR` | Confirmation remains open; action reads busy and duplicate submits are blocked | Stay in Sessions & jobs; that file and its scoped check-ins/credit disappear, other imports remain | Failed request leaves the import and confirmation intact for retry | Confirmation action |
| Check in expected volunteer | Check in on a roster row for today | Row action reads Saving; other mutation actions disabled | Stay on roster; row becomes On deck and appears in On deck now | Reload authoritative data after any error; if the requested state exists, confirm it instead of inviting a duplicate | Same row action |
| Check out expected volunteer | Check out on row or On deck now | Same row-pending contract | Stay; row becomes Completed and credit is earned | Reload and reconcile completed state | Same row context |
| Undo desk check-in | Undo on a check-in made by this desk | Same row-pending contract | Return assignment to expected list | File-originated completion cannot be undone | Same row context |
| Add/check out walk-in | Imported meet jobs or a manual session, then On deck now | Form/row busy state | Clear the successful form; active list updates and imported walk-ins remain exportable | Reload and compare new/removed entry identity | Form or row context |
| Export signup | Download .xls for one import | Browser download | Original twelve-column order with completed credit applied | Non-200 response leaves source data unchanged | Link remains available |

Roster activation scope is the exact Gregorian date-only value plus event title. A repeated title on another date is a separate meet and cannot deactivate or inherit attendance from the first. Corrected files preserve check-in state only when date, title, job, slot, and normalized volunteer name all match.

Check-in uses `America/Chicago` as the club timezone. Imported meets follow their scheduled date by default. An admin may persist a per-meet manual `open` or `closed` override and may return it to `scheduled`; manual close wins over the deployment-level early-check-in flag. Future and past rosters remain viewable, and closing blocks only new check-ins—existing on-deck rows can still be checked out or undone. Walk-in sessions continue to use their session date and session status. `ALLOW_EARLY_CHECKIN=true` is an explicit deployment override for scheduled check-in and is off by default.

The expected-volunteer roster remains the primary check-in flow with its existing search, assignment credit, check-in and check-out controls. A separate collapsed walk-in panel accepts a new parent/volunteer name and a new swimmer name as free text; neither person needs to be in the imported file or the swimmer directory. When the meet is open, the operator chooses one of its existing jobs (including the exact shift times), may adjust credit, and checks the parent onto the deck. The new assignment persists in the same history and twelve-column workbook export. Repeat uploads retain the roster unchanged even when walk-ins increased its row count; corrected uploads carry walk-ins forward for the same meet.

Volunteer display names may be inferred from the file's Volunteer Info field, but public check-in and reports never display an email address or phone number as the person's name. When one exact account has one unambiguous supplied volunteer name, blank sibling shifts reuse that name; otherwise the account name remains the fallback. The unmodified source fields remain in D1 so same-format export can reproduce the original workbook columns.

Admin form validation is app-owned. Dates must be real `YYYY-MM-DD` values, times must be valid 24-hour values, and end time must be later than start time. Missing sessions/entries return explicit 404 or conflict responses. Unexpected server details are not exposed to the browser.

Admin PIN failures are keyed by a one-way value derived from the Cloudflare client address and limited to eight failures in fifteen minutes. The signed admin cookie remains host-only, HTTP-only, SameSite=Strict, and twelve hours. Clearing all volunteer data is disabled unless `ALLOW_DATA_RESET` or `DEMO_MODE` is explicitly true; local demos retain typed `RESET` confirmation.

Clearing one imported roster is a separate, admin-only destructive action. It requires typing `CLEAR`, removes only that import's saved assignments, check-ins, earned credit, and meet settings, and cannot be undone; other imports, sessions, jobs, and swimmers are retained.

## Verification and migration scope

Run TypeScript, ESLint, npm test, DESIGN.md lint and strict premium audit. Browser tests in `tests/ui/multi-event.py` cover the achievement workflow. `tests/ui/volunteer-live-day.py` covers empty/load-failure recovery, admin login/reveal, the supplied signup workbook, same-format download, same-title meets on different dates, scheduled/manual open and manual close, check-out after close, normal check-in/out, lost-response recovery, future-date blocking, invalid times, PIN throttling, and narrow layout. Static audit scans the app; browser verification is scoped to changed workflows.
