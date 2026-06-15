<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Reflection-Gated Photo Submission

- **Plan**: context/changes/reflection-gated-submission/plan.md
- **Scope**: All Phases (1–2 of 2)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION → resolved via triage
- **Findings**: 0 critical  5 warnings  2 observations

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

### F1 — photoUrl stored and rendered without protocol validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx:136 (preview) + :227 (feed)
- **Detail**: photoUrl written to Firestore and rendered in two `<img src={...}>` with no protocol check. javascript:/data: URIs possible from any whitelisted member, visible to all.
- **Fix Applied**: Added `new URL(photoUrl.trim()).protocol !== "https:"` guard inside handleSubmit before addDoc, with user-facing error.
- **Decision**: FIXED via Fix A

### F2 — double-submit window in success path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality + Pattern Consistency
- **Location**: app/routes/challenges.tsx (success path)
- **Detail**: `setSubmitting(false)` before `setFormOpen(false)` briefly re-enabled the Publish button between renders — a rapid double-click could fire a second addDoc.
- **Fix Applied**: Removed `setSubmitting(false)` from the success path; form teardown handles cleanup.
- **Decision**: FIXED

### F3 — bare catch {} discards error; missing console.error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/challenges.tsx (catch block)
- **Detail**: Bare `catch {}` (no binding) permanently lost the Firebase error. Sibling `challenges.new.tsx` binds and logs errors.
- **Fix Applied**: Changed to `catch (err) { console.error("Submission failed:", err); ... }`.
- **Decision**: FIXED

### F4 — no unmount guard on async submit handler

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/routes/challenges.tsx (handleSubmit)
- **Detail**: Post-`await` setState calls could run on an unmounted component if the card is removed from the feed while addDoc is in-flight.
- **Fix Applied**: Added `mountedRef = useRef(true)` + cleanup effect + `if (!mountedRef.current) return` after await.
- **Decision**: FIXED via Fix A

### F5 — parent_submission_id: null is premature schema noise

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: app/routes/challenges.tsx (addDoc payload)
- **Detail**: `parent_submission_id: null` stored on every S-02 write; the field belongs to S-03 and Firestore rules don't require it.
- **Fix Applied**: Removed from addDoc payload.
- **Decision**: FIXED

### F6 — canPublish vs canSubmit naming inconsistency

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/challenges.tsx:~40
- **Detail**: `canPublish` deviates from sibling `challenges.new.tsx` which uses `canSubmit` for the identical pattern.
- **Fix Applied**: Renamed `canPublish` → `canSubmit` across all 3 references.
- **Decision**: FIXED
