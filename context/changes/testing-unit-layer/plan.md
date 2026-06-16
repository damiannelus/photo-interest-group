# Testing Unit Layer — Implementation Plan

## Overview

Bootstrap Vitest and establish a passing unit test suite covering four contracts called out in `context/foundation/test-plan.md` Phase 1: `buildSubmissionTree` correctness (R3), gate predicate trim-consistency (R6/R7), whitelist email normalization, and listener cleanup. Requires extracting three categories of code currently embedded in `challenges.tsx`: pure utility functions, the `parseAllowedEmails` helper, and the three `onSnapshot` custom hooks.

## Current State Analysis

- No test runner, no test files, no test scripts in `package.json`.
- `buildSubmissionTree` lives as a module-level function in `app/routes/challenges.tsx` (line 378) — not exported.
- Gate predicates are inline `const` expressions inside component bodies: `canPost` (line 44), `canFollowUp` (line 45), `canSubmit` (line 448). Cannot be imported.
- Three `onSnapshot` sites in `challenges.tsx` (lines 59-79, 492-517, 664-689) each follow `return unsub` cleanup — testable once extracted to custom hooks.
- `allowedEmails.ts` (line 1-4) builds the array directly from `import.meta.env` with no separately importable function.
- Domain types (`Submission`, `Challenge`, `Comment`) already live in `app/types/` — no type migration needed.
- `app/firebase.ts` throws at module evaluation if any `VITE_*` env vars are absent — any test that imports it (directly or transitively) must mock it.

## Desired End State

- `npm test` runs Vitest in single-pass mode and exits 0.
- Three test files cover pure functions: `submissionTree.test.ts`, `gatePredicates.test.ts`, `allowedEmails.test.ts`.
- Three test files cover hook cleanup: `useComments.test.ts`, `useChallengeSubmissions.test.ts`, `useActiveChallenges.test.ts`.
- `challenges.tsx` is refactored to import from the new modules; its runtime behaviour is unchanged.
- `context/foundation/test-plan.md` §3 Phase 1 status can be updated to `complete`.

### Key Discoveries

- `~/` path alias resolves to `./app/` (tsconfig.json `paths`). `vitest.config.ts` must replicate this alias — the `reactRouter()` Vite plugin must NOT be included in Vitest's config.
- `package.json` has `"type": "module"` — `vitest.config.ts` must use ESM syntax (`import.meta.url`, not `__dirname`).
- `parent_submission_id` is typed `string | null` in the `Submission` interface, but old Firestore documents may have the field absent entirely (value is `undefined`). The `?? null` guard in `buildSubmissionTree` handles this — tests must exercise the `undefined` path using type assertions.
- `canFollowUp` checks `!!user` (presence only, no user properties) — the extracted pure function takes `hasUser: boolean`, not the Firebase `User` object.

## What We're NOT Doing

- No component (RTL render) tests — those belong in a future phase.
- No Firestore emulator / security rules tests — that is Phase 2.
- No CI wiring — that is Phase 3.
- No coverage reporting — deferred until the test suite has enough mass to warrant it.
- No rename of existing variable names inside `challenges.tsx` — only the source-of-truth for each predicate moves; the `const canPost = ...` local aliases stay.

## Implementation Approach

Three sequential phases. Each phase is independently runnable and leaves the app in a working state:

1. **Infrastructure** — install deps, write `vitest.config.ts`, wire `npm test`. No source changes.
2. **Extract + test pure functions** — move `buildSubmissionTree`, extract gate predicates, expose `parseAllowedEmails`. Update `challenges.tsx` imports once. Write the three pure-function test suites.
3. **Extract + test hooks** — pull each `onSnapshot` block into a named hook. Update `challenges.tsx` to call the hooks. Write the three cleanup test suites.

## Critical Implementation Details

**Firebase init throws in test environment.** `app/firebase.ts` runs `initializeApp()` at module evaluation and throws if any `VITE_*` var is absent. Any test file whose import graph reaches `~/firebase` must declare `vi.mock('~/firebase', () => ({ db: {} }))` — this is every hook test. Omitting it causes every hook test to fail with a module-evaluation error before any test body runs.

**`vi.mock()` calls are hoisted by Vitest.** Place `vi.mock(...)` calls at the top of each test file before import statements to keep the hoisting behaviour explicit and predictable. Do not call `vi.mock()` inside `beforeEach` or test bodies.

**`vitest.config.ts` must not include `reactRouter()`.** The React Router Vite plugin registers routes at build time and breaks module resolution during test collection. The config must import from `vitest/config` (not `vite`), set the `~/` alias manually, and include no framework plugins.

---

## Phase 1: Vitest Infrastructure

### Overview

Install the test stack, create the Vitest config, and add `npm test` / `npm run test:watch` scripts. Deliverable: `vitest run` exits 0 with "no test files found" — proves the runner and config are wired before any tests exist.

### Changes Required

#### 1. Install dev dependencies

**File**: `package.json` (via `npm install`)

**Intent**: Add Vitest (runner), `@testing-library/react` (for `renderHook` in Phase 3), and `jsdom` (DOM environment for hooks) as dev dependencies.

**Contract**: Run:
```
npm install --save-dev vitest @testing-library/react jsdom
```
The three packages land in `devDependencies`.

#### 2. Create Vitest config

**File**: `vitest.config.ts` (new, at project root)

**Intent**: Configure Vitest with `jsdom` environment (needed for hook lifecycle), `globals: true` (so tests do not need to import `describe`/`it`/`expect`), and the `~/` path alias to match `tsconfig.json`. Explicitly do not include the `reactRouter()` Vite plugin.

**Contract**: The config must:
- Import from `vitest/config`, not from `vite`
- Set `test.environment` to `'jsdom'`
- Set `test.globals` to `true`
- Define `resolve.alias` mapping `'~'` to the absolute path of `./app` using `import.meta.url` (not `__dirname`, which is unavailable in ESM)

#### 3. Add test scripts

**File**: `package.json`

**Intent**: Expose `npm test` for single-pass runs (CI/agents) and `npm run test:watch` for interactive development.

**Contract**: Add to `"scripts"`:
- `"test"`: `"vitest run"`
- `"test:watch"`: `"vitest"`

### Success Criteria

#### Automated Verification

- `npm test` exits 0 (Vitest runs, finds no tests, reports success)
- No TypeScript errors in `vitest.config.ts`: `npm run typecheck` still passes

#### Manual Verification

- Running `npm test` in the terminal shows Vitest's "no test files found" summary, not a config error or module resolution failure

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Extract Pure Utilities and Write Their Tests

### Overview

Extract `buildSubmissionTree`, the three gate predicates, and `parseAllowedEmails` into individually importable modules. Update `challenges.tsx` to call the extracted functions (runtime behaviour unchanged). Write the three pure-function test suites.

### Changes Required

#### 1. Create app/lib/submissionTree.ts

**File**: `app/lib/submissionTree.ts` (new)

**Intent**: Hold `buildSubmissionTree` as an exported, framework-free utility. Imports only `Submission` from `~/types/submission` and standard JS. No Firebase, no React.

**Contract**: Exports one named function `buildSubmissionTree(submissions: Submission[]): Map<string | null, Submission[]>`. Implementation is moved verbatim from `challenges.tsx` lines 378-393. Remove the function from `challenges.tsx` and replace with an import.

#### 2. Create app/lib/gatePredicates.ts

**File**: `app/lib/gatePredicates.ts` (new)

**Intent**: Three pure boolean functions, one per gated action. Each takes only primitive arguments (strings, booleans) so tests need no React or Firebase.

**Contract**: Exports three named functions:
- `checkCanPost(text: string, submitting: boolean): boolean` — mirrors `canPost` in SubmissionCard: `text.trim().length >= 10 && !submitting`
- `checkCanSubmit(photoUrl: string, reflection: string, submitting: boolean): boolean` — mirrors `canSubmit` in ChallengeCard: `photoUrl.trim().length > 0 && reflection.trim().length >= 50 && !submitting`
- `checkCanFollowUp(hasUser: boolean, photoUrl: string, reflection: string, submitting: boolean): boolean` — mirrors `canFollowUp` in SubmissionCard: `hasUser && photoUrl.trim().length > 0 && reflection.trim().length >= 50 && !submitting`

In `challenges.tsx`, replace the three inline consts with calls to the imported functions. The local variable names (`canPost`, `canSubmit`, `canFollowUp`) stay the same; only their right-hand side changes.

#### 3. Add parseAllowedEmails export to app/lib/allowedEmails.ts

**File**: `app/lib/allowedEmails.ts`

**Intent**: Expose the normalization logic as a pure function so tests can invoke it with any input string without touching `import.meta.env`.

**Contract**: Extract the pipeline (`.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)`) into an exported `parseAllowedEmails(envString: string): string[]` function. Rewrite the `allowedEmails` const to call it: `parseAllowedEmails(import.meta.env.VITE_ALLOWED_EMAILS ?? '')`. The existing exported `allowedEmails` array remains the default export used at runtime.

#### 4. Write app/lib/submissionTree.test.ts

**File**: `app/lib/submissionTree.test.ts` (new, co-located)

**Intent**: Cover the R3 failure scenarios: `undefined` parent field (old Firestore docs), `null` parent field (explicit root), real parent IDs, child sort order ascending by `createdAt`, and "no submissions dropped" across a mixed input.

**Contract**: Uses a minimal Timestamp stub `{ toMillis: () => ms }` cast as `any` — no Firebase import needed. Test inputs use `as any` to exercise the `undefined` path that the TypeScript type elides. Six test cases: undefined parent → null bucket, null parent → null bucket, real ID → correct bucket, no submissions dropped from mixed array, children sorted ascending by `toMillis()`, root group order unchanged from input.

#### 5. Write app/lib/gatePredicates.test.ts

**File**: `app/lib/gatePredicates.test.ts` (new, co-located)

**Intent**: Prove R7 — the trim-consistency invariant. For every gate function: whitespace-only input at or above the character minimum must fail; non-whitespace at the exact minimum must pass; `submitting: true` must block regardless of field content.

**Contract**: Three `describe` blocks, one per function. Key cases per block:
- `checkCanPost`: 10 spaces fails; 9 real chars fails; 10 real chars passes; submitting blocks.
- `checkCanSubmit`: 50 spaces reflection fails; 49 real chars reflection fails; exactly 50 real chars passes; whitespace-only URL fails; submitting blocks.
- `checkCanFollowUp`: `hasUser: false` fails; whitespace reflection fails; all-valid passes; submitting blocks.

#### 6. Write app/lib/allowedEmails.test.ts

**File**: `app/lib/allowedEmails.test.ts` (new, co-located)

**Intent**: Prove the normalization contract for `parseAllowedEmails`: lowercase, trim, split on commas, filter empties.

**Contract**: Five cases: uppercase input is lowercased; padded whitespace is trimmed; comma-separated list yields correct-length array; whitespace-only entries are filtered out; empty string returns empty array.

### Success Criteria

#### Automated Verification

- `npm test` passes all tests across the three new test files
- `npm run typecheck` still passes (the challenges.tsx import paths resolve correctly)

#### Manual Verification

- Open `challenges.tsx` and confirm the three gate predicate `const` lines now call the imported functions. Submit a comment with 9 characters in the dev server — Publish button remains disabled. Submit with 10 — it enables. This confirms the live gate behaviour is unchanged.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Extract Custom Hooks and Write Cleanup Tests

### Overview

Extract the three `onSnapshot` `useEffect` blocks from `challenges.tsx` into named hooks. Update the component to call the hooks. Write the six cleanup test cases (two per hook: unmount cleanup and, for `useComments`, toggle-close cleanup).

### Changes Required

#### 1. Create app/hooks/useActiveChallenges.ts

**File**: `app/hooks/useActiveChallenges.ts` (new)

**Intent**: Encapsulate the active-challenges Firestore subscription (currently at `challenges.tsx` lines 664-689). Returns `challenges`, `loading`, and `error` state.

**Contract**: Exports `useActiveChallenges(): { challenges: Challenge[]; loading: boolean; error: string | null }`. Internally subscribes on mount with `orderBy('createdAt', 'desc')` and `where('status', '==', 'active')`, sets state via the snapshot callback, and returns the `onSnapshot` unsubscribe function from the `useEffect` return. Imports `db` from `~/firebase` and Firestore utilities from `firebase/firestore`.

In `challenges.tsx`, replace the corresponding `useEffect` block and its three `useState` declarations with a single call to `useActiveChallenges()`.

#### 2. Create app/hooks/useChallengeSubmissions.ts

**File**: `app/hooks/useChallengeSubmissions.ts` (new)

**Intent**: Encapsulate the per-challenge submissions subscription (currently at `challenges.tsx` lines 492-517). Returns `submissions`, `subsLoading`, and `subsError`.

**Contract**: Exports `useChallengeSubmissions(challengeId: string): { submissions: Submission[]; subsLoading: boolean; subsError: string | null }`. Subscribes with `where('challengeId', '==', challengeId)` and `orderBy('createdAt', 'desc')`. Returns the `onSnapshot` unsubscribe from the `useEffect`. Dependency array is `[challengeId]`.

In `challenges.tsx`, replace the corresponding `useEffect` block and its three state declarations with a call to `useChallengeSubmissions(challenge.id)`.

#### 3. Create app/hooks/useComments.ts

**File**: `app/hooks/useComments.ts` (new)

**Intent**: Encapsulate the per-submission comments subscription (currently at `challenges.tsx` lines 59-79), including the conditional `if (!commentOpen) return` guard. Returns `comments`, `commentCount`, `commentsLoading`, and `loadError`.

**Contract**: Exports `useComments(submissionId: string, commentOpen: boolean): { comments: Comment[]; commentCount: number; commentsLoading: boolean; loadError: string | null }`. When `commentOpen` is false, the `useEffect` returns undefined (no subscription). When true, subscribes with `orderBy('createdAt', 'asc')` on the `submissions/{submissionId}/comments` subcollection. Returns the `onSnapshot` unsubscribe from the `useEffect`. Dependency array is `[commentOpen, submissionId]`.

In `challenges.tsx`, replace the comments `useEffect` and the four state declarations it manages with a call to `useComments(submission.id, commentOpen)`.

#### 4. Write hook cleanup tests

**Files**:
- `app/hooks/useActiveChallenges.test.ts` (new)
- `app/hooks/useChallengeSubmissions.test.ts` (new)
- `app/hooks/useComments.test.ts` (new)

**Intent**: Prove the R6 contract — each `onSnapshot` subscription is cleaned up when it should be. Every test file mocks both `~/firebase` and `firebase/firestore`.

**Contract**: Each test file opens with:
```ts
vi.mock('~/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
}))
```

`useActiveChallenges` and `useChallengeSubmissions` test cases (two each):
1. `onSnapshot` is called once on mount.
2. The unsubscribe spy returned by `onSnapshot` is called exactly once on `unmount()`.

`useComments` test cases (four):
1. `onSnapshot` is NOT called when `commentOpen` is false.
2. `onSnapshot` IS called when `commentOpen` is true.
3. Unsubscribe spy is called on `unmount()` when hook was open.
4. Unsubscribe spy is called when `commentOpen` changes from `true` to `false` (via `rerender`).

All tests use `renderHook` from `@testing-library/react`. The `onSnapshot` mock returns `vi.fn()` as the unsubscribe spy, captured before the render so it can be asserted after.

### Success Criteria

#### Automated Verification

- `npm test` passes all tests (pure-function suites from Phase 2 + hook suites from Phase 3)
- `npm run typecheck` still passes

#### Manual Verification

- In the dev server: open a challenge, confirm submissions load. Open and close the comment section on a submission — the toggle works. This confirms the hook extraction preserved the real subscription behaviour.
- Update `context/foundation/test-plan.md` §3 Phase 1 row: change `status` from `change opened` to `complete`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

- `buildSubmissionTree`: six cases — `undefined`/`null`/real-ID parent key routing, total count invariant, child sort ascending, root order preserved.
- Gate predicates: whitespace-at-boundary fails; one-under-minimum fails; exact-minimum passes; `submitting` flag blocks regardless. Three functions × ~4 cases = ~12 cases.
- `parseAllowedEmails`: lowercase, trim, split, filter-empty, empty-string. Five cases.
- Hook cleanup: subscribe on mount, unsubscribe on unmount, no-subscribe when guard is false, unsubscribe on dependency change. Three hooks × 2-4 cases = 8-10 cases.

### Integration Tests

None in this phase. Phase 2 (Firestore emulator) covers cross-boundary integration.

### Manual Testing Steps

1. `npm test` reports all suites green.
2. `npm run dev` starts without errors.
3. Challenges page loads and displays active challenges (real-time listener works).
4. Expanding a challenge shows submissions (per-challenge listener works).
5. Toggling comments open/closed on a submission functions without console errors (useComments toggle path works).
6. Submitting a comment with 9 characters leaves Publish disabled; 10 enables it.
7. Submitting a photo without a 50-character reflection leaves Publish disabled.

## Migration Notes

`challenges.tsx` is the only production file that changes. It shrinks as logic moves out. All imports are path-based and will fail fast (TypeScript error) if the extracted modules are missing or mis-named — the typecheck CI gate catches regressions before they reach the browser.

## References

- Test plan: `context/foundation/test-plan.md` — §2 Risk Map (R3, R6, R7), §3 Phase 1, §6 Phase 1 Cookbook
- Lessons: `context/foundation/lessons.md` — trim-consistency rule (the origin of R7)
- Source under test: `app/routes/challenges.tsx` (buildSubmissionTree: 378, canPost: 44, canFollowUp: 45, canSubmit: 448, onSnapshot sites: 59, 492, 664)
- Existing lib: `app/lib/allowedEmails.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Infrastructure

#### Automated

- [x] 1.1 `npm test` exits 0 (Vitest runs with no test files found)
- [x] 1.2 `npm run typecheck` still passes after adding vitest.config.ts

#### Manual

- [x] 1.3 Terminal shows Vitest summary (not a config or resolution error)

### Phase 2: Extract Pure Utilities and Write Their Tests

#### Automated

- [ ] 2.1 `npm test` passes all tests in submissionTree.test.ts
- [ ] 2.2 `npm test` passes all tests in gatePredicates.test.ts
- [ ] 2.3 `npm test` passes all tests in allowedEmails.test.ts
- [ ] 2.4 `npm run typecheck` passes after challenges.tsx import updates

#### Manual

- [ ] 2.5 Gate predicate live behaviour verified in dev server (9-char comment stays disabled, 10 enables)

### Phase 3: Extract Custom Hooks and Write Cleanup Tests

#### Automated

- [ ] 3.1 `npm test` passes all tests in useActiveChallenges.test.ts
- [ ] 3.2 `npm test` passes all tests in useChallengeSubmissions.test.ts
- [ ] 3.3 `npm test` passes all tests in useComments.test.ts
- [ ] 3.4 `npm run typecheck` passes after hook extraction

#### Manual

- [ ] 3.5 Dev server: challenges load, submissions load, comment toggle works without errors
- [ ] 3.6 `context/foundation/test-plan.md` §3 Phase 1 status updated to `complete`
