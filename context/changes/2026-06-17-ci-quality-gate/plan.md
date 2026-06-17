# CI Quality Gate — Implementation Plan

## Overview

Close out Phase 2 (Firestore rules tests — already implemented, not yet recorded) and wire Phase 3: unit tests + Firestore emulator security-rules tests into both GitHub Actions workflows so every push and every PR is gated before deploy.

## Current State Analysis

Phase 2 (rules tests) shipped without a change folder or test-plan status update. The tests are complete and passing:
- `tests/rules/firestore.rules.test.ts` — 20 tests covering R1–R5
- `package.json` scripts: `test:rules` and `test:rules:emulator`
- `firestore.rules` has the correct `matches('.*\\S.*') && .size() >= 50` rule

Phase 3 is unstarted. Both CI workflows already run `npm run typecheck` but neither runs `npm test` or the emulator rules suite. The `test:rules:emulator` script lacks the `--project demo-*` flag needed for auth-free CI execution.

## Desired End State

Every push to `main` and every PR:
1. Runs `npm test` (unit tests — `app/` only, ~5 s) — failure blocks build and deploy
2. Starts the Firestore emulator and runs `npm run test:rules:emulator` (~60 s) — failure blocks build and deploy
3. Build and deploy proceed only when both pass

`npm run typecheck` already gates both workflows and is unchanged.

### Key Discoveries

- Both workflows are single-job sequential: typecheck → build → deploy. Tests slot in between typecheck and build.
- `ubuntu-latest` ships with OpenJDK; no `setup-java` step needed for Firebase emulators.
- `firebase emulators:exec` reads `firebase.json` for emulator port config (`8080`) and loads rules via `firestore.rules`. Both files are in the repo root — no CI setup needed beyond installing `firebase-tools`.
- Using `--project demo-photo-interest-group` in the emulator exec command skips Firebase CLI authentication entirely (the `demo-` prefix is Firebase's documented offline-mode convention). Without this, CI would require a `FIREBASE_TOKEN` secret.
- `initializeTestEnvironment` in the test file passes `rules: RULES` directly — the emulator doesn't need to pre-load rules by project; rules are injected programmatically.
- VITE_* secrets are only needed at `npm run build` time (already the case) — test steps need no env vars.

## What We're NOT Doing

- Not adding a `FIREBASE_TOKEN` or new service-account secret — the `demo-` project flag makes auth unnecessary for emulator runs
- Not restructuring workflows into multi-job (test + build in parallel) — sequential steps are sufficient at this scale
- Not adding `--passWithNoTests` to `test:rules:emulator` — there are always tests in that directory
- Not running `npm run test:rules` (vitest only, no emulator) in CI — the emulator version is the authoritative test

## Implementation Approach

Two phases, ordered: close out the already-shipped Phase 2 first (context hygiene), then implement the CI wiring. CI changes follow a copy-symmetric pattern — both workflow files get identical new steps inserted between `npm run typecheck` and `npm run build`.

## Critical Implementation Details

**`--project demo-photo-interest-group` flag**: The `test:rules:emulator` script must include this flag for CI. Without it, `firebase emulators:exec` attempts to authenticate with Firebase using the resolved project from `.firebaserc` — which fails in a runner with no login session. The `demo-` prefix is the Firebase-documented way to run the CLI in offline mode without any credentials.

**Step ordering is load-bearing**: Tests must precede `npm run build`. The build step is the first point where `VITE_*` secrets are consumed; running tests after build would add unnecessary latency before feedback. Tests → build → deploy is the correct sequence.

---

## Phase 1: Close Out Phase 2

### Overview

Phase 2 (Firestore rules layer) is complete but unrecorded. Create the missing change folder and update the test-plan status so the context system reflects reality.

### Changes Required

#### 1. Phase 2 change folder

**File**: `context/changes/2026-06-16-firestore-rules-phase2/change.md` (new file)

**Intent**: Record that Phase 2 shipped. The change folder was never created when the tests were written.

**Contract**: Standard change.md frontmatter with `status: complete`, `created: 2026-06-16`, `updated: 2026-06-17`. Body describes what shipped: emulator-backed security rules test suite covering R1–R5 (whitespace bypass, whitelist enforcement, ownership rules, `parent_submission_id` integrity).

#### 2. Test-plan Phase 2 status

**File**: `context/foundation/test-plan.md`

**Intent**: Update §3 Phase 2 row status from `implementing` to `complete` and set the change folder to the correct path.

**Contract**: In the §3 Phased Rollout table, Phase 2 row: `Status` cell → `complete`, `Change folder` cell → `context/changes/2026-06-16-firestore-rules-phase2/`.

### Success Criteria

#### Automated Verification

- `context/changes/2026-06-16-firestore-rules-phase2/change.md` exists with `status: complete`
- `context/foundation/test-plan.md` Phase 2 row reads `complete`

#### Manual Verification

- Spot-check the test-plan §3 table renders correctly (no broken columns)

---

## Phase 2: CI Quality Gate Wiring

### Overview

Add unit tests and Firestore emulator rules tests to both GitHub Actions workflows. Tests run before build and gate the deploy step on both PR and merge paths.

### Changes Required

#### 1. Fix `test:rules:emulator` for auth-free CI

**File**: `package.json`

**Intent**: Add `--project demo-photo-interest-group` to the `test:rules:emulator` script so it can run in CI without Firebase authentication.

**Contract**: The script becomes:
```
firebase emulators:exec --only firestore --project demo-photo-interest-group "vitest run tests/rules"
```
Local runs are unaffected — the `demo-` project prefix is valid locally too and skips the project-resolution round-trip.

#### 2. Merge workflow — add test steps

**File**: `.github/workflows/firebase-hosting-merge.yml`

**Intent**: Insert unit test and emulator rules test steps between `npm run typecheck` and `npm run build` so test failures prevent live deploys.

**Contract**: After the existing `- run: npm run typecheck` step, add:
```yaml
      - run: npm test
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      - run: npm run test:rules:emulator
```
No env vars on these steps — all VITE_* secrets remain on the `npm run build` step only.

#### 3. PR workflow — add test steps

**File**: `.github/workflows/firebase-hosting-pull-request.yml`

**Intent**: Same as the merge workflow — tests gate the preview deploy on every PR.

**Contract**: Identical three-step insertion after `- run: npm run typecheck`, before `- run: npm run build`.

#### 4. Test-plan Phase 3 status

**File**: `context/foundation/test-plan.md`

**Intent**: Update §3 Phase 3 row to reflect completion.

**Contract**: Phase 3 row: `Status` cell → `complete`, `Change folder` cell → `context/changes/2026-06-17-ci-quality-gate/`.

### Success Criteria

#### Automated Verification

- `npm test` exits 0 locally (unit tests pass without emulator)
- `npm run test:rules:emulator` exits 0 locally (requires emulator; run manually to confirm the demo-project flag works)
- Both workflow YAML files have the three new steps in the correct position (after typecheck, before build)

#### Manual Verification

- Push a commit or open a PR; confirm in the GitHub Actions run log that the CI step sequence is: `npm ci` → `npm run typecheck` → `npm test` → `Install Firebase CLI` → `npm run test:rules:emulator` → `npm run build` → deploy
- Confirm the emulator test step shows ≥ 20 tests passing in the CI log
- Introduce a deliberate unit test failure locally (`npm test`); confirm it exits non-zero
- Confirm `test-plan.md` §3 Phase 3 row reads `complete`

**Implementation Note**: After Phase 2 and all automated verification passes, pause for manual confirmation that a real CI run succeeds before marking this change complete.

---

## Testing Strategy

### Unit Tests

- `npm test` — `app/` only; currently 29 tests across 5 suites; all pass without any running infrastructure

### Rules Tests

- `npm run test:rules:emulator` — 20 tests; requires emulator; covers R1–R5; run with `--project demo-photo-interest-group` for auth-free execution

### Manual Testing Steps

1. Run `npm test` locally — confirm exit 0
2. Run `npm run test:rules:emulator` — confirm 20 tests pass, confirm `demo-photo-interest-group` flag doesn't break anything
3. Push branch to GitHub — watch the Actions tab; confirm both new steps appear in the log and pass
4. Verify CI step order in the log matches the plan (tests before build, deploy only after all tests pass)

## References

- Test plan: `context/foundation/test-plan.md` §3
- Rules test file: `tests/rules/firestore.rules.test.ts`
- Security rules: `firestore.rules`
- Emulator config: `firebase.json` (port 8080)
- Merge workflow: `.github/workflows/firebase-hosting-merge.yml`
- PR workflow: `.github/workflows/firebase-hosting-pull-request.yml`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Close Out Phase 2

#### Automated

- [x] 1.1 `context/changes/2026-06-16-firestore-rules-phase2/change.md` exists with `status: complete`
- [x] 1.2 `test-plan.md` Phase 2 row reads `complete`

#### Manual

- [x] 1.3 Test-plan §3 table renders correctly

### Phase 2: CI Quality Gate Wiring

#### Automated

- [ ] 2.1 `npm test` exits 0 locally
- [ ] 2.2 `npm run test:rules:emulator` exits 0 locally with demo-project flag
- [ ] 2.3 Both workflow YAML files have the three new steps after typecheck, before build

#### Manual

- [ ] 2.4 Real CI run shows correct step sequence in GitHub Actions log
- [ ] 2.5 Emulator test step shows ≥ 20 tests passing in CI log
- [ ] 2.6 `test-plan.md` Phase 3 row reads `complete`
