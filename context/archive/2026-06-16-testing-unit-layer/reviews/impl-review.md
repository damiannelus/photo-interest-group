<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Unit Layer

- **Plan**: `context/changes/testing-unit-layer/plan.md`
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Race condition in getCountFromServer promise

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/hooks/useComments.ts:27–33
- **Detail**: The getCountFromServer effect fires a promise with no cancellation guard. Two scenarios: (a) component unmounts before promise resolves → setCommentCount called on ghost component; (b) submissionId changes while old promise is in-flight → stale count overwrites the new value. The onSnapshot useEffect directly below returns its unsub correctly; this effect has no equivalent cleanup return.
- **Fix**: Add a boolean cancellation flag inside the effect:
  ```ts
  useEffect(() => {
    let cancelled = false;
    getCountFromServer(collection(db, "submissions", submissionId, "comments"))
      .then((snap) => { if (!cancelled) setCommentCount(snap.data().count); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [submissionId]);
  ```
  - Strength: Eliminates ghost-setState and stale-write. Matches mountedRef guard pattern in lessons.md.
  - Tradeoff: Three-line change; no API or interface impact.
  - Confidence: HIGH — identical cancel-flag pattern used in original SubmissionCard mountedRef.
  - Blind spot: None significant.
- **Decision**: FIXED — added `cancelled` flag with cleanup return to getCountFromServer useEffect

### F2 — ChallengeCard catch block missing mountedRef guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx (ChallengeCard.handleSubmit catch)
- **Detail**: Pre-existing issue surfaced by Phase 3 file read. The try block guards with `if (!mountedRef.current) return` but the catch block calls `setSubmitError` and `setSubmitting(false)` without the guard. If the write fails after unmount, both setState calls fire on a ghost. SubmissionCard.handlePost catch correctly has the guard.
- **Fix**: Add `if (!mountedRef.current) return;` at the top of the catch block in ChallengeCard.handleSubmit before the two setState calls.
- **Decision**: FIXED — added `if (!mountedRef.current) return;` at top of catch block

### F3 — getCountFromServer promise-after-unmount not tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/hooks/useComments.test.ts
- **Detail**: The hook test suite has no case verifying getCountFromServer does not call setCommentCount after unmount. The current mock resolves synchronously, so the race never manifests in tests — but neither is it proven safe. If F1's cancellation guard is later removed, there is no regression test.
- **Fix**: After fixing F1, add a test using a deferred promise that resolves after unmount and asserts setCommentCount is not called.
- **Decision**: FIXED — added deferred-promise test that unmounts before resolve and asserts commentCount stays 0

### F4 — useComments has undocumented getCountFromServer effect

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: app/hooks/useComments.ts:27–33
- **Detail**: Plan specified useComments to encapsulate only the onSnapshot subscription. Implementation also absorbed the getCountFromServer badge-count seed effect. Correct adaptation (commentCount had to move into the hook), but undocumented in the plan.
- **Fix**: No code change needed. Acceptable to note as known scope adaptation.
- **Decision**: SKIPPED — correct adaptation; no action needed

### F5 — npm test script deviates from plan spec

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: package.json:9
- **Detail**: Plan specified `"test": "vitest run"`. Actual is `"test": "vitest run --passWithNoTests"`. Justified: Vitest v4 exits 1 with no test files, which would have broken the Phase 1 success criterion. Flag has no effect once test files exist.
- **Fix**: No change needed. Justified runtime adaptation.
- **Decision**: SKIPPED — justified runtime adaptation; Vitest v4 changed exit-code behaviour

### F6 — Hook snapshot callbacks not exercised in tests

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/hooks/useActiveChallenges.test.ts, app/hooks/useChallengeSubmissions.test.ts
- **Detail**: The two simpler hook tests verify wiring only. Neither invokes the captured snapshot callback with a fake snap object to verify setChallenges/setSubmissions mapping, or that the error callback sets the error string. A regression in the doc.data() spread would not be caught. Within plan scope but worth noting for the next testing phase.
- **Fix**: Deferred to a future phase — add callback behavioral tests when component-level RTL tests are introduced.
- **Decision**: SKIPPED — callback behavioral tests deferred to next testing phase
