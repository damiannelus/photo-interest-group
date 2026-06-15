<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Follow-Up Submission Implementation Plan

- **Plan**: context/changes/follow-up-submission/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-06-15
- **Verdict**: APPROVED (all findings fixed)
- **Findings**: 0 critical  4 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — handleSubmit never resets submitting on success

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx:475–483
- **Detail**: handleSubmit in ChallengeCard clears photoUrl/reflection/formOpen on success but never calls setSubmitting(false). Only the catch branch resets it. After a successful root submission the "Submit Photo" button stays permanently disabled until the component re-mounts. Pre-existing bug, now more visible because Phase 3 keeps components in the DOM longer. handleFollowUp and handlePost both reset correctly on success.
- **Fix**: Add `setSubmitting(false);` after `setFormOpen(false);` in the success path. Matches the pattern in handleFollowUp:149 and handlePost:97. One-line change, no tradeoff.
- **Decision**: FIXED

### F2 — SubmissionList recursion unbounded on Firestore cycles

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx:393–418
- **Detail**: depth prop is clamped at 3 via Math.min but the recursion itself continues indefinitely. A Firestore document cycle (A → parent B, B → parent A) hangs the browser tab. Not producible by the normal UI but can be introduced via admin console or SDK. Fix also simplifies the code.
- **Fix**: Replace Math.min with an early return: add `if (depth > 3) return null;` as the first line of SubmissionList, then pass `depth={depth + 1}` (no Math.min needed).
- **Decision**: FIXED

### F3 — Image preview renders before HTTPS validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx:236–242 (follow-up), 552–557 (root)
- **Detail**: Preview `<img>` fires on any non-empty URL before protocol check. Browser makes requests to http://, file://, or internal addresses while typing. Pre-existing in the root form; the follow-up form reproduces it.
- **Fix**: Add `fuPhotoUrl.trim().startsWith("https://")` guard to the follow-up preview condition; apply the same to the root form photoUrl preview.
- **Decision**: FIXED

### F4 — buildSubmissionTree produces a new Map on every ChallengeCard render

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/challenges.tsx:636–640
- **Detail**: `buildSubmissionTree(submissions)` is called inline in JSX. Every ChallengeCard state change (formOpen, photoUrl, reflection, etc.) triggers a full O(n) rebuild and re-renders every SubmissionCard in the tree, not just when submissions data changes.
- **Fix**: `const subTree = useMemo(() => buildSubmissionTree(submissions), [submissions]);` — pass `byParent={subTree}`. useMemo already in react import.
- **Decision**: FIXED

### F5 — Submission count badge includes follow-up children

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx:626–628
- **Detail**: "N submission(s)" counts the flat array including follow-ups. 3 roots + 2 follow-ups = "5 submissions".
- **Fix**: `const rootCount = submissions.filter(s => (s.parent_submission_id ?? null) === null).length;` and use rootCount in the badge.
- **Decision**: FIXED

### F6 — canFollowUp omits !!user

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/challenges.tsx:45, 187–195
- **Detail**: canFollowUp has no !!user check. Currently safe because the Follow-Up button is in `{user && ...}`, but that render guard is a single point of failure. canSubmit and canPost have the same omission — consistent but fragile.
- **Fix (optional)**: Add `!!user &&` to canFollowUp.
- **Decision**: FIXED

### F7 — buildSubmissionTree sort order for roots relies on implicit Firestore ordering

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/challenges.tsx:385–391
- **Detail**: The null bucket (root submissions) is intentionally not sorted — it relies on Firestore's `orderBy("createdAt", "desc")`. This contract is not documented in the code; a query change or isolated unit test would break root ordering silently.
- **Fix**: Add a comment: `// Root submissions keep Firestore query order (desc by createdAt). Child groups sorted asc for chronological chain display.`
- **Decision**: FIXED
