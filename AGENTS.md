# JTSC shared development rules

These rules apply to anyone changing this repository, including Codex and Claude. `CHANGELOG.md` records what changed; `RELEASES.md` records the last verified, deployed checkpoint.

1. Before editing, read `git status -sb`, `CHANGELOG.md`, and `RELEASES.md`. Treat existing uncommitted and untracked files as someone else's work unless the current task clearly owns them. When two people or agents are editing at once, use a separate branch/worktree or coordinate before touching the same files.
2. Keep each commit focused on one request. Stage explicit files, not `git add .`, and do not include unrelated changes, generated previews, uploaded files, secrets, or private swimmer/volunteer data. Never discard or overwrite someone else's work to make a checkout clean.
3. For every meaningful behavior, design, data, or deployment change, add a dated entry to `CHANGELOG.md` describing the outcome and the checks actually run. If a check failed or was not run, say so. Commit the entry with the change when possible. Git history remains the detailed file-by-file record.
4. Before calling a change ready, run the relevant lint, type, tests, build, and browser checks. A passing build alone does not prove a workflow works. Check the changed path and one nearby workflow on mobile when UI is involved.
5. Push and deploy only when requested or clearly part of the current task. Before pushing, list commits not yet on `origin/main`; tell the user if an unrelated commit would be included. After deployment, verify the live URL and record the exact commit, Cloudflare version ID, tests, and recovery tag in `RELEASES.md`.
6. Mark a commit `stable/YYYY-MM-DD` (add a suffix if needed) only after deployment and a successful production smoke test. Push the annotated tag so either assistant can recover it from a clone. A tag marks a tested code checkpoint, not a database backup or a guarantee of zero bugs.
7. If a release breaks, inspect `RELEASES.md` and compare against the stable tag. Make a new fix or revert commit; do not use `git reset --hard`, force-push, or roll back D1 data without explicit authorization. Database schema/data recovery is separate from a code rollback.
8. End each handoff with the current branch/commit, changed behavior, checks and failures, deployment status, and any uncommitted files that were deliberately left alone.

`README.md` remains the product and setup guide. `DESIGN.md` and `UX-CONTRACT.md` remain the design and behavior contracts; this file does not replace them.
