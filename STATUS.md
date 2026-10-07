# STATUS — shared working state

**Both Claude Code and Codex read and write this file.** It is the handoff
between them. Git history says what already happened; this file says what is
happening *now* and what is next.

- Read it at the **start** of every session, before touching code.
- Update it **before you stop**, even if you finished nothing.
- Keep it short. It is a whiteboard, not a log — `CHANGELOG.md` is the log.
- If something here contradicts the repository, the repository wins. Fix the
  entry rather than working from it.

## Protocol

1. **Claim before you edit.** Put your name (`claude` or `codex`), the date,
   and the files you expect to touch in *Work in flight*. If the other
   assistant already claims a file you need, pick different work or say in your
   reply that the two tasks collide — do not edit around them.
2. **One owner per file at a time.** Uncommitted changes you did not make
   belong to the other assistant. Never stash, revert, checkout or "clean up"
   someone else's working tree.
3. **Release when you stop.** Move the row out of *Work in flight* into
   *Recently finished* with the commit SHA, or leave it with a note saying
   exactly where you stopped and what is half-done.
4. **Record blockers.** Anything that needs the user — a decision, a secret, a
   deploy, a push — goes in *Needs the user*, phrased as a question.
5. **Deploys and pushes are user-initiated.** Do not push or deploy unless the
   current task says to. When one happens, update *Current state* and
   `RELEASES.md` together.

---

## Current state

_Last updated: 2026-10-07 by codex_

| | |
| --- | --- |
| Branch | `main` |
| Checked-in local work | `558076c` — Rename new team record achievement; `a8d397d` — handoff record (not pushed) |
| Pushed to `origin/main` | Yes — up to date through `9acfbd7`; the two 2026-10-07 commits are intentionally local pending a requested release |
| Last verified production | `3552e57`, tag `stable/2026-10-05`, Worker version `eec9f9cc-62cf-4d00-8716-3ffb71105f53` |
| Live URL | https://jtsc-team-hub.sushilh.workers.dev/ |
| Test suite | 70 tests (`npm test`) |

## Work in flight

| Owner | Since | What | Files claimed | State |
| --- | --- | --- | --- | --- |
Nothing claimed right now.

## Recently finished

| Date | Owner | What | Commit |
| --- | --- | --- | --- |
| 2026-10-07 | codex | Renamed the Finish Line and Admin Meet Report new-record milestone to `NEW JTSC TEAM RECORD`; browser preview/export coverage added | `558076c` |
| 2026-10-05 | codex | Deployed the Central Zone Sectionals standards and Admin Meet Report feature; production route and mobile Admin smoke checks passed | `3552e57` · `stable/2026-10-05` |
| 2026-09-25 | claude | New Admin "Meet Report" tab: upload a meet-results XLS, surface notable performances (new records, standards met) against `lib/state-qualifying-times.mjs`, hand off to Achievement Studio pre-filled | `3552e57` |
| 2026-09-25 | claude | Add Central Zone Region 8 Sectionals + Bonus standards to state-times (age-unrestricted, SCY+LCM) | `88fd0ec` |
| 2026-09-25 | codex + user | Committed, pushed, and deployed everything from the prior handoff (state-times ladder, LCM records, Finish Line fix, doc updates) | `30981f5` · `stable/2026-09-25` |
| 2026-09-17 | user | Deployed admin export work; recorded in `RELEASES.md` | `b036166` |
| 2026-09-17 | codex | State qualifying times page wired into the hub, committed, pushed, and deployed | `7aa6254` · `stable/2026-09-17-2` |
| 2026-09-17 | claude | Save volunteer-hour exports to D1 (Admin → Reports "Save export") | `0df6f89` |
| 2026-09-16 | codex | Editable Finish Line card layout | `d87efd8` |
| 2026-09-16 | codex | Shared change/release tracking docs | `084be87` |
| 2026-09-16 | codex | Finish Line achievement card template | `db571e7` |
| 2026-09-16 | claude | Small-meet poster presets (1/2/3-session templates) | `731c686` |
| 2026-09-16 | claude | Parent Guide 3D motion and inline graphics | in history before `731c686` |
| 2026-09-16 | claude | Brag video (`brag-output/`, gitignored, not part of the app) | not committed by design |
| 2026-09-25 | codex | Finish Line editable text/photo interactions, State Times ladder + LCM records, and shared development docs committed, pushed, and deployed | `37c36e3`, `529a9ff`, `30981f5` · `stable/2026-09-25` |

## Next up

Nothing is assigned. Add a row when the user picks one; delete it when it is
done or dropped.

| Priority | What | Why it matters | Notes |
| --- | --- | --- | --- |
| — | _(empty)_ | | |

## Needs the user

- **Reset button on production.** The user asked to keep "Clear all data"
  visible on the deployed site. Commit `349a3a4` later reverted it to opt-in
  and `UX-CONTRACT.md` documents the opt-in behavior. Which is correct?
- **Should "Clear all data" also wipe saved ledger exports?** The new
  `ledger_exports` table (Admin → Reports → Save export) is deliberately left
  out of `reset_signup_data`'s wipe, on the theory that a saved export's whole
  point is to survive a season reset. If that is wrong, add
  `DELETE FROM ledger_exports` to the reset batch in
  `lib/volunteer-service.mjs`.
- **Google Drive export target?** The user asked about saving exports to
  "database or Google Drive." Only the D1 save was built (see
  `CHANGELOG.md`); Drive needs an OAuth app and consent flow the user hasn't
  set up yet.

## Known open issues

- `Claude outputs/` sits untracked in the repository root. It is now gitignored;
  it can be deleted from disk whenever the user wants.
- `npm run lint` on its own trips over untracked non-app folders. Lint passes
  when `brag-output/**` and `Claude outputs/**` are excluded.
- `AdminApp.jsx` and `VolunteerApp.jsx` are not covered by `tsc --noEmit`.
  Runtime errors in them surface only in a browser.
