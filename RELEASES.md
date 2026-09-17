# Release checkpoints

This is the recovery index for deployed code. A checkpoint is marked stable only after the live site is tested. The release tag is shared on GitHub; it does not back up or roll back the Cloudflare D1 database.

| Status | Date (America/Chicago) | Git commit | Stable tag | Cloudflare Worker version | Verification |
| --- | --- | --- | --- | --- | --- |
| Current known-good production | 2026-09-17 | `0df6f89` | `stable/2026-09-17` | `93c35509-c607-4364-b0d6-8afd8520660d` | Pushed `main`; live root and `/admin` returned HTTP 200; admin export changes deployed |
| Current known-good production | 2026-09-16 | `db571e7` | `stable/2026-09-16` | `a9f12b4b-3eaf-4c80-ae3f-6d238d436587` | 37 automated tests; lint, typecheck, strict UI audit; live 390px browser test and 1080×1350 PNG download |

Production: [JTSC Team Hub](https://jtsc-team-hub.sushilh.workers.dev/).

To inspect changes since this checkpoint, run `git log stable/2026-09-16..HEAD --oneline` and `git diff stable/2026-09-16..HEAD`. To start a recovery fix, create a new branch from the tag and verify it locally. Do not reset or force-push shared history. Code rollback does not revert D1 migrations or volunteer records.

After the next verified deployment, add a new row with the exact deployed commit and Worker version, then create and push an annotated `stable/YYYY-MM-DD` tag (with a suffix for multiple releases on one day). Keep older rows and tags; they are recovery points.
