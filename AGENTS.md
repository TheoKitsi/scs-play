# Agent Instructions — SCS Play

## Project and publishing target

- Repository: `TheoKitsi/scs-play`; remote `origin`: `https://github.com/TheoKitsi/scs-play.git`.
- Production branch: `main`.
- Existing live game: **https://theokitsi.github.io/scs-play/**.
- Stack: vanilla JavaScript ES modules, CSS partials, Playwright QA, and Capacitor for Android.
- Follow the source conventions in `CONTRIBUTING.md`, `ARCHITECTURE.md`, and `BUILD.md`.
- Edit source files in `js/`, `css/`, and the root app files. `docs/` is ignored, generated production output from `npm run build:prod`.
- Use Node.js 22 or newer; GitHub Actions uses Node.js 24.

## Required completion flow: commit → push → deploy

When the user requests committing and pushing changes, merging updates, or publishing the game, complete the flow through deployment to the existing live URL. Deployment after a production push is part of the task and does not require another request.

1. Inspect `git status`, `git diff`, `git diff --cached`, and `git log --oneline -10`. Stage only the intended task files and use a concise English commit message matching the existing history.
2. Fetch the remote state and synchronize with `origin/main` without rewriting history. Respect the existing branch protections and linear-history requirement; an admin override requires explicit user authorization.
3. For application, dependency, build, or workflow changes, run `npm run verify` before publishing and fix failures. For documentation-only changes, review the content and run `git diff --check`; the push still runs the full GitHub CI gate.
4. Commit the intended changes and push them. The release must reach `origin/main`: a local commit or a push to a feature branch does not publish the game. If working through a task branch, finish the authorized merge into `main`.
5. Every push to `main`, including a PR merge, automatically starts `.github/workflows/deploy.yml` (**Deploy to GitHub Pages**). It runs `npm ci`, builds `docs/` with `npm run build:prod`, uploads that artifact, and deploys it through `actions/deploy-pages`. `.github/workflows/ci.yml` (**CI**) runs in parallel.
6. Identify the exact production commit SHA and wait for **both** its CI and Pages deployment runs to finish successfully. Match runs by SHA rather than assuming the latest run belongs to this task. Use `gh run watch <run-id> --exit-status` for each run.
7. Check the published site at **https://theokitsi.github.io/scs-play/**. For gameplay or UI changes, run the existing smoke test against that deployment using `SCS_BASE`.
8. After a successful merge, delete the fully integrated task branches and prune stale remote-tracking refs. Finish on `main`, synchronized with `origin/main`; the requested final branch state is only `main`.
9. Report the published commit SHA, live URL, and verification/deployment results. A queued, running, cancelled, or failed deployment does not count as completed publishing; investigate failures and report any actual blocker.

### Check the production runs

From the repository root, after the release is on local and remote `main`:

```powershell
$releaseSha = git rev-parse HEAD
gh run list --repo TheoKitsi/scs-play --branch main --commit $releaseSha --workflow ci.yml --json databaseId,headSha,status,conclusion,url
gh run list --repo TheoKitsi/scs-play --branch main --commit $releaseSha --workflow deploy.yml --json databaseId,headSha,status,conclusion,url
```

Wait for the matching run IDs with `gh run watch <run-id> --exit-status` and inspect failed jobs with `gh run view <run-id> --log-failed`.

### Smoke-test the live game

```powershell
$previousBase = $env:SCS_BASE
try {
    $env:SCS_BASE = "https://theokitsi.github.io/scs-play/"
    npm run smoke-test
} finally {
    $env:SCS_BASE = $previousBase
}
```

The deploy workflow is already automatic for pushes to `main`; this file makes completing and checking that workflow a standing agent instruction.
