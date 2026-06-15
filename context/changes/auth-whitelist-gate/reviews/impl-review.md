<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth + Whitelist Gate

- **Plan**: context/changes/auth-whitelist-gate/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Client-only whitelist; no server-side enforcement until F-03 ships

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: app/routes/login.tsx:8–11, app/routes/_protected.tsx:5–8
- **Detail**: `VITE_ALLOWED_EMAILS` is bundled into the JS payload. Any user can read the allowed list in DevTools. More importantly, Firebase Auth issues tokens regardless of whitelist membership — a user not on the list can bypass the client check and call Firestore/Storage APIs directly. The plan explicitly acknowledges this ("UI gate only… server-side enforcement layer is Firestore Security Rules (F-03)") and states "both must be in place before the app is considered secure." F-03 is the resolution; this is a known gap, not an implementation mistake.
- **Fix**: Implement F-03 (firestore-schema-and-rules) before exposing the app to untrusted users. Ensure Firestore rules check `request.auth.token.email` and `request.auth.token.email_verified == true`.
  - Strength: F-03 is already planned in parallel; no new design work needed.
  - Tradeoff: App is insecure in the window between F-02 (this change) and F-03 shipping.
  - Confidence: HIGH — the plan's own analysis identifies this exact gap.
  - Blind spot: Whether F-03 is actively being worked on and its ETA.
- **Decision**: FIXED — F-03 prioritised as next change

### F2 — `allowedEmails` logic duplicated in two files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/routes/login.tsx:8–11, app/routes/_protected.tsx:5–8
- **Detail**: The 4-line `allowedEmails` constant (split → trim → lowercase → filter) is copy-pasted verbatim in both files. If normalisation logic needs to change, both must be updated in sync.
- **Fix**: Extract to `app/lib/allowedEmails.ts` and import from both files.
- **Decision**: FIXED

### F3 — `signOut` failure not caught in RejectionScreen

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/components/RejectionScreen.tsx:8–11
- **Detail**: `navigate("/login")` is called unconditionally after `await signOut(auth)`. If sign-out fails (e.g. network error), the user lands on `/login`, the auth state still shows a signed-in rejected user, and `LoginPage`'s `useEffect` immediately sets `rejected = true` again — a confusing loop.
- **Fix**: Wrap in try/catch; navigate only on success; show an inline error message on failure.
- **Decision**: FIXED

### F4 — Stale `rejected` state not cleared on auth re-transition in LoginPage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/login.tsx:19–27
- **Detail**: If a rejected user signs into a different (whitelisted) account in another tab, the `useEffect` re-runs with the new `user`. But `rejected` is still `true`, so `<RejectionScreen />` is rendered instead of navigating to `/`. The navigate would only fire if `rejected` is cleared first.
- **Fix**: Add `setRejected(false)` at the top of the `useEffect` body before the `if (!loading && user)` check.
- **Decision**: FIXED

### F5 — Manual Progress rows unchecked in plan.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/auth-whitelist-gate/plan.md (Progress § manual rows)
- **Detail**: All 8 manual rows across phases 1–3 are `- [ ]` in the Progress section. The user confirmed each phase verbally during implementation, but the checkboxes were never flipped.
- **Fix**: Flip all manual rows to `- [x]` in plan.md.
- **Decision**: FIXED

### F6 — `auth/popup-blocked` could have a more specific error message

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/login.tsx:42–47
- **Detail**: A browser-blocked popup falls through to the generic "Sign-in failed. Please try again." message, which doesn't tell the user what to do.
- **Fix**: Add a branch for `auth/popup-blocked` → "Your browser blocked the sign-in popup. Please allow popups for this site and try again."
- **Decision**: FIXED
