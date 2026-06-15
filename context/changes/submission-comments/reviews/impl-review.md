<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Submission Comments (S-04)

- **Plan**: `context/changes/submission-comments/plan.md`
- **Scope**: All Phases (1–3)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION → resolved via triage
- **Findings**: 0 critical | 2 warnings | 1 observation

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — onSnapshot missing error handler

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: `app/routes/challenges.tsx:52–65`
- **Detail**: SubmissionCard's onSnapshot had no error callback. On a Firestore permission error or network failure, `commentsLoading` stayed `true` forever — a permanent "Loading comments…" spinner with no user escape. Both other onSnapshot calls in the file (ChallengeCard, ChallengeFeed) pass an error callback as the third argument.
- **Fix Applied**: Added error callback matching ChallengeCard pattern — `setCommentsLoading(false)` + `setSubmitError("Failed to load comments. Please refresh.")` in the error branch.
- **Decision**: FIXED via Fix A

### F2 — handleDelete: missing mountedRef guard and submitError reuse

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: `app/routes/challenges.tsx:93–102`
- **Detail**: `handleDelete`'s catch branch called `setSubmitError` without a `mountedRef` guard — inconsistent with `handlePost` which guards both branches before any `setState`. Also, delete failures wrote to `submitError` (the post form's error state), causing the error to linger until the next Post attempt.
- **Fix Applied**: Added `if (!mountedRef.current) return` before `setSubmitError` in the catch branch.
- **Decision**: FIXED

### F3 — Character counter uses raw .length; validation uses .trim().length

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: `app/routes/challenges.tsx:195–202`
- **Detail**: `canPost` evaluated `commentText.trim().length >= 10`. The counter's className condition and display value used `commentText.length` (raw). A user typing 10 spaces saw the counter turn green and "10 / 10 characters", but the Post button stayed disabled.
- **Fix Applied**: Changed both counter references from `commentText.length` to `commentText.trim().length`. Also saved as a lesson in `context/foundation/lessons.md` ("Trim-consistent gate and display").
- **Decision**: FIXED + ACCEPTED-AS-RULE: Trim-consistent gate and display
