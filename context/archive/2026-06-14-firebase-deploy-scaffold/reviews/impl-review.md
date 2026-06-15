<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Firebase Deploy Scaffold

- **Plan**: context/changes/firebase-deploy-scaffold/plan.md
- **Scope**: All Phases (1–3)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

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

### F1 — Floating FirebaseExtended action tag is a supply-chain risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: both .github/workflows/*.yml (action-hosting-deploy@v0)
- **Detail**: Both workflows used @v0 (floating tag). Compromised upstream = arbitrary code with access to Firebase SA secret.
- **Decision**: FIXED via Fix A — pinned to e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c (v0.10.0) in both workflows.

### F2 — No validation guard before initializeApp

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/firebase.ts:12
- **Detail**: initializeApp called with no check for missing VITE_FIREBASE_* vars — fails with cryptic internal Firebase error.
- **Decision**: FIXED — added missing-key guard that throws a clear error listing absent vars.

### F3 — No Node.js version pin in CI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: both .github/workflows/*.yml
- **Detail**: No actions/setup-node step — build runs on whatever Node ships with ubuntu-latest runner.
- **Decision**: FIXED — added actions/setup-node@v4 with node-version: '20' and cache: 'npm' to both workflows.

### F4 — Firebase Agent Skills added as unplanned scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .agents/, AGENTS.md, skills-lock.json (90 files)
- **Detail**: firebase init prompted for Agent Skills; user accepted. Not in plan. Benign reference docs.
- **Decision**: ACCEPTED — files pose no risk; accepted as-is.

### F5 — app/firebase.ts is currently dead code

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: app/firebase.ts
- **Detail**: Exported app not imported anywhere — expected, F-02/F-03 will consume it.
- **Decision**: SKIPPED — by design.

### F6 — Merge workflow missing permissions block

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/firebase-hosting-merge.yml
- **Detail**: PR workflow had explicit permissions; merge workflow ran with repo default (broader) token scope.
- **Decision**: FIXED — added permissions: contents: read at workflow level.

### F7 — No typecheck step in CI

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: both .github/workflows/*.yml
- **Detail**: npm run typecheck exists locally but not in CI — type errors only caught locally.
- **Decision**: FIXED — added npm run typecheck step before build in both workflows.

### F8 — /__/auth/** rewrite destination needs smoke-testing for email auth

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: firebase.json:10-13
- **Detail**: Rewrite sends /__/auth/** → /__/auth/handler; email action links use /__/auth/action. Firebase Hosting handles this internally but needs end-to-end verification when F-02 enables email auth.
- **Decision**: SKIPPED — test when F-02 wires email auth before launch.
