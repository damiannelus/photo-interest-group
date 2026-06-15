<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Firestore Schema + Security Rules

- **Plan**: `context/changes/firestore-schema-and-rules/plan.md`
- **Scope**: All Phases (1–2 of 2)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION (triaged → all fixed)
- **Findings**: 0 critical  3 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — authorUid can be mutated on submission update

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: firestore.rules:22–23
- **Detail**: The update rule checked resource.data.authorUid (stored) but did not pin request.resource.data.authorUid (incoming). A user could overwrite authorUid to any UID on update, corrupting ownership permanently.
- **Fix**: Split `allow update, delete` into separate rules; added `request.resource.data.authorUid == resource.data.authorUid` guard on update.
- **Decision**: FIXED — 9746451

### F2 — createdBy can be mutated on challenge update

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: firestore.rules:13–14
- **Detail**: Same pattern as F1 on the challenges collection. update rule did not pin request.resource.data.createdBy.
- **Fix**: Split `allow update, delete`; added `request.resource.data.createdBy == resource.data.createdBy` guard on update.
- **Decision**: FIXED — 9746451

### F3 — No update rule on comments (latent mutation risk)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: firestore.rules:25–31
- **Detail**: Comments had create and delete but no update rule. Ambiguous: intentional immutability or omission?
- **Fix**: Added `// no update rule: comments are intentionally immutable after posting` comment.
- **Decision**: FIXED — 9746451

### F4 — token.email assumption (Google Sign-In only)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: firestore.rules:6–7, 35
- **Detail**: `request.auth.token.email` used in `isWhitelisted()`. Safe failure mode for non-Google providers (null → deny) but assumption was implicit.
- **Fix**: Added `// Assumes Google Sign-In; token.email is always populated for Google auth users` comment above `isWhitelisted()`.
- **Decision**: FIXED — 9746451

### F5 — Redundant /__/auth/** rewrite in firebase.json

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: firebase.json:13–16
- **Detail**: The `/__/auth/**` → `/__/auth/handler` rewrite is handled automatically by Firebase Hosting. Redundant entry scaffolded in F-01.
- **Fix**: Removed the `/__/auth/**` rewrite entry.
- **Decision**: FIXED — 9746451
