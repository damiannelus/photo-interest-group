# Testing Unit Layer — Plan Brief

> Full plan: `context/changes/testing-unit-layer/plan.md`
> Test plan: `context/foundation/test-plan.md` (§3 Phase 1, §6 Phase 1 Cookbook)

## What & Why

Bootstrap Vitest and prove four contracts defined in the project test plan (Phase 1): `buildSubmissionTree` correctness, gate predicate trim-consistency, whitelist email normalization, and `onSnapshot` listener cleanup. These are the three highest-value unit-testable risks (R3, R6, R7) that currently have zero automated coverage. Getting them green unlocks the Phase 2 (Firestore emulator) and Phase 3 (CI) rollout.

## Starting Point

The app has no test runner, no test scripts, and no test files. The functions to be tested exist but are not extractable — `buildSubmissionTree` is a non-exported function inside a route file, gate predicates are inline component constants, and `onSnapshot` blocks are embedded in component `useEffect` bodies. Domain types are already separated in `app/types/`.

## Desired End State

`npm test` runs Vitest and exits 0, covering six test files: three for pure functions (`buildSubmissionTree`, gate predicates, email normalization) and three for hook cleanup (`useComments`, `useChallengeSubmissions`, `useActiveChallenges`). `challenges.tsx` is refactored to import from the extracted modules; runtime behaviour is identical. Test plan §3 Phase 1 status advances to `complete`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Gate predicate location | `app/lib/gatePredicates.ts` | Clean lib/ convention; no React dependency; importable by tests and components alike | Plan |
| buildSubmissionTree location | `app/lib/submissionTree.ts` | Pure utility with no framework dependency belongs in lib/, not a route file | Plan |
| Type location | Existing `app/types/` — no migration needed | Types are already separated; discovered during codebase research | Plan |
| Listener cleanup strategy | Extract to custom hooks, test with `renderHook` | Tests the real hook lifecycle without rendering full component trees; matches test plan's "unit test" intent | Plan |
| Vitest config | Separate `vitest.config.ts` | Keeps `reactRouter()` plugin out of test collection; prevents false module resolution failures | Plan |
| allowedEmails testability | Export `parseAllowedEmails(envString)` pure function | Fully pure — no env stubbing or Vite-specific plumbing needed in tests | Plan |
| Test file location | Co-located with source | Find the test by finding the source file; consistent with Vitest's default glob | Plan |

## Scope

**In scope:** Vitest install + config, extract `buildSubmissionTree` + gate predicates + `parseAllowedEmails`, extract three `onSnapshot` hooks, six test suites, update `challenges.tsx` imports.

**Out of scope:** Component (RTL render) tests, Firestore emulator / security rules tests (Phase 2), CI wiring (Phase 3), coverage reporting, any new product functionality.

## Architecture / Approach

Extraction creates a small lib layer and a hooks layer that `challenges.tsx` delegates to. No new abstractions beyond what the test plan prescribes; the route file shrinks as logic moves out.

```
app/
  lib/
    submissionTree.ts     ← moved from challenges.tsx (line 378)
    gatePredicates.ts     ← extracted from challenges.tsx (lines 44, 45, 448)
    allowedEmails.ts      ← existing; adds parseAllowedEmails export
  hooks/
    useActiveChallenges.ts    ← extracted from challenges.tsx (line 664)
    useChallengeSubmissions.ts← extracted from challenges.tsx (line 492)
    useComments.ts            ← extracted from challenges.tsx (line 59)
  routes/
    challenges.tsx        ← imports from new modules; runtime behaviour unchanged
```

Pure-function tests need no mocking. Hook tests mock `~/firebase` (to prevent the init-time throw on missing env vars) and `firebase/firestore` (to control the `onSnapshot` unsubscribe spy).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest infrastructure | `npm test` runs (zero tests) | Path alias misconfiguration silently swallows test imports |
| 2. Extract + test pure functions | 3 test suites green, challenges.tsx imports updated | Extraction changes observable gate behaviour if a trim() call is accidentally dropped |
| 3. Extract + test hooks | All 6 suites green, cleanup contract proven | Hook extraction changes component subscription lifecycle if `useEffect` deps differ |

**Prerequisites:** Node + npm available; `npm install` succeeds; dev server boots (`npm run dev`) before and after each phase.

**Estimated effort:** ~2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- `@testing-library/react` must be a version compatible with React 19 (`^19.2.6`). If the latest release lags behind React 19 support, a specific version pin may be needed — verify after install.
- `app/firebase.ts` is the only non-obvious mock requirement; any test importing it (directly or transitively) without a `vi.mock` will fail at module evaluation, not at test runtime — the error message may be confusing without knowing the cause.

## Success Criteria (Summary)

- `npm test` exits 0 with all six test suites passing.
- Gate behaviour is unchanged: 9-char comment stays disabled, 10 enables; 49-char reflection stays disabled, 50 enables.
- `context/foundation/test-plan.md` §3 Phase 1 status is `complete`.
