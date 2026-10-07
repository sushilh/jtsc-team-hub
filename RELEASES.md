# Release checkpoints

This is the recovery index for deployed code. A checkpoint is marked stable only after the live site is tested. The release tag is shared on GitHub; it does not back up or roll back the Cloudflare D1 database.

| Status | Date (America/Chicago) | Git commit | Stable tag | Cloudflare Worker version | Verification |
| --- | --- | --- | --- | --- | --- |
| Current known-good production | 2026-10-07 | `59e8f90` | `stable/2026-10-07` | `b3d4280c-234f-47d6-93f1-a26884c252b3` | Pushed `main`; live `/` and `/parent-guide` returned HTTP 200; live Achievement Studio browser workflow passed at desktop and 390px, with reduced motion, the Meet Report team-record handoff, editable age/bracket footer blocks, and PNG preview/export parity; 71 automated tests, typecheck, lint, strict UI audit, DESIGN.md lint |
| Current known-good production | 2026-10-05 | `3552e57` | `stable/2026-10-05` | `eec9f9cc-62cf-4d00-8716-3ffb71105f53` | Pushed `main`; live `/`, `/state-times`, `/parent-guide`, `/volunteers`, and `/admin` returned HTTP 200; live mobile Admin Meet Report login/tab/upload-control smoke passed; 70 automated tests, typecheck, lint |
| Current known-good production | 2026-09-25 | `30981f5` | `stable/2026-09-25` | `40b063f6-4a47-47ee-91de-2ad916431f06` | Pushed `main`; live `/`, `/state-times`, `/parent-guide`, and `/admin` returned HTTP 200; live `tests/ui/finish-editor.py` passed desktop/mobile drag, resize, keyboard, overlays, reset, and PNG parity; 56 automated tests, typecheck, lint |
| Current known-good production | 2026-09-17 | `7aa6254` | `stable/2026-09-17-2` | `58347ae9-6d80-47fb-9015-7c43ff3a1921` | Pushed `main`; live State Times hub workflow passed at 390px; root and `/state-times` served successfully; 53 automated tests, typecheck, lint |
| Current known-good production | 2026-09-17 | `0df6f89` | `stable/2026-09-17` | `93c35509-c607-4364-b0d6-8afd8520660d` | Pushed `main`; live root and `/admin` returned HTTP 200; admin export changes deployed |
| Current known-good production | 2026-09-16 | `db571e7` | `stable/2026-09-16` | `a9f12b4b-3eaf-4c80-ae3f-6d238d436587` | 37 automated tests; lint, typecheck, strict UI audit; live 390px browser test and 1080×1350 PNG download |

Production: [JTSC Team Hub](https://jtsc-team-hub.sushilh.workers.dev/).

To inspect changes since this checkpoint, run `git log stable/2026-09-16..HEAD --oneline` and `git diff stable/2026-09-16..HEAD`. To start a recovery fix, create a new branch from the tag and verify it locally. Do not reset or force-push shared history. Code rollback does not revert D1 migrations or volunteer records.

After the next verified deployment, add a new row with the exact deployed commit and Worker version, then create and push an annotated `stable/YYYY-MM-DD` tag (with a suffix for multiple releases on one day). Keep older rows and tags; they are recovery points.
