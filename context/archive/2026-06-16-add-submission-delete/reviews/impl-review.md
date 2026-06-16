<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Add Submission Delete

- **Plan**: `context/changes/add-submission-delete/plan.md`
- **Scope**: Phase 1 of 1 (full plan)
- **Date**: 2026-06-16
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical  2 warnings  0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → FIXED |
| Architecture | PASS |
| Pattern Consistency | WARNING → FIXED |
| Success Criteria | PASS |

## Findings

### F1 — Stale deleteError persists across retry attempts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: `app/routes/challenges.tsx:124` (handleDeleteSubmission)
- **Detail**: handleDeleteSubmission never cleared deleteError before calling deleteDoc. If a first attempt failed and showed an error, a second attempt would keep the old error visible throughout the new call. handlePost and handleFollowUp both clear their error states before the await call.
- **Fix**: Added `setDeleteError(null)` at the top of the try block, before `deleteDoc` — one line, matching handlePost and handleFollowUp.
- **Decision**: FIXED

### F2 — No in-progress guard on handleDeleteSubmission

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: `app/routes/challenges.tsx:124–133` (handleDeleteSubmission)
- **Detail**: handleDeleteSubmission was the only write handler in SubmissionCard without an in-progress guard. handlePost and handleFollowUp both disable their buttons via canPost/canFollowUp checking a submitting flag. Without a guard, a second click + confirm while the first deleteDoc was in flight could issue a concurrent call; if the first had already succeeded, the second would hit "document not found" and set deleteError spuriously.
- **Fix**: Added `const [isDeleting, setIsDeleting] = useState(false)`. Set `true` before `deleteDoc`; set `false` in the catch block (success path auto-unmounts via onSnapshot). Added `disabled={isDeleting}` to the Delete button with `disabled:opacity-50 disabled:cursor-not-allowed` styling and `"Deleting…"` in-flight label, consistent with the Publish button patterns.
- **Decision**: FIXED
