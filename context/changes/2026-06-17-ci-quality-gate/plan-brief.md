# CI Quality Gate — Plan Brief

> Full plan: `context/changes/2026-06-17-ci-quality-gate/plan.md`

## What & Why

Wire the test suites — unit tests and Firestore emulator security-rules tests — into GitHub Actions so every push and every PR is gated before the deploy step runs. The test-plan (§3) defined this as Phase 3; Phase 2 (rules tests) also shipped without being recorded, so this plan closes that out first.

## Starting Point

Both CI workflows already run `npm run typecheck` and proceed straight to build. Unit tests and emulator rules tests exist and pass locally but are absent from CI. The `test:rules:emulator` npm script is missing the `--project demo-*` flag needed to run without Firebase authentication in a CI runner.

## Desired End State

Every GitHub Actions run (PR preview and live merge) follows: typecheck → unit tests → emulator rules tests → build → deploy. A failure at any test step prevents the build and deploy from running. Phase 2 and Phase 3 of the test-plan are both marked `complete` with correct change folders.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Emulator tests on PRs | Both PR and merge | Security-rules regressions are high-impact and should be caught before landing in main | Plan |
| CI job structure | Sequential steps in existing job | Minimal diff to existing workflows; sequential is fast enough at this scale | Plan |
| firebase-tools install | `npm install -g firebase-tools` step | No new devDependency; latest version always used; explicit and transparent | Plan |
| Auth-free emulator | `--project demo-photo-interest-group` flag | Firebase `demo-` projects skip CLI auth — no new secrets needed | Plan |
| VITE_* secrets | Unchanged — build step only | Unit tests and emulator tests require no Firebase config | Plan |

## Scope

**In scope:**
- Close out Phase 2 change folder + test-plan status
- Add `npm test` step to both CI workflows
- Add Firebase CLI install + `npm run test:rules:emulator` step to both CI workflows
- Update `test:rules:emulator` script with `--project demo-*` flag
- Update test-plan Phase 3 status to `complete`

**Out of scope:**
- Multi-job workflow restructure (test + build in parallel)
- Adding a `FIREBASE_TOKEN` or new service-account secret
- Changing the emulator port or test file structure
- Any new tests — the suites already exist

## Architecture / Approach

Both workflow files get identical three-step additions inserted after the existing `npm run typecheck` step and before `npm run build`. A single `package.json` script fix (`--project demo-photo-interest-group`) makes the emulator command auth-free everywhere. No new secrets, no new jobs, no new dependencies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Close out Phase 2 | `change.md` + test-plan status corrected | None — purely administrative |
| 2. CI quality gate | Both workflows gate on unit + emulator tests | Emulator step might fail in CI if firebase-tools version has a breaking change |

**Prerequisites:** None — the test suites and workflow files already exist.  
**Estimated effort:** ~1 session; 5 files changed.

## Open Risks & Assumptions

- `ubuntu-latest` has OpenJDK pre-installed — if GitHub changes the runner image, a `setup-java` step may be needed
- `npm install -g firebase-tools` pulls the latest CLI version — a future major version bump could change `emulators:exec` flags; pinning the version is a future option if instability occurs

## Success Criteria (Summary)

- A real GitHub Actions run shows the emulator test step with ≥ 20 passing tests in the log
- A deliberate test failure prevents the deploy step from running
- `test-plan.md` §3 shows both Phase 2 and Phase 3 as `complete`
