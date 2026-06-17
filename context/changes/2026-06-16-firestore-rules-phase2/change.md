---
id: 2026-06-16-firestore-rules-phase2
title: Firestore Rules Layer — Phase 2
status: complete
created: 2026-06-16
updated: 2026-06-17
---

# Firestore Rules Layer — Phase 2

Emulator-backed security rules test suite covering R1–R5: whitespace bypass on the reflection gate, whitelist enforcement (member allowed / non-member and unauthenticated denied on all collection paths), ownership rules (Bob cannot update or delete Alice's submission), and `parent_submission_id` integrity (follow-up written with correct parent doc ID).

20 tests in `tests/rules/firestore.rules.test.ts` using `@firebase/rules-unit-testing`. The `firestore.rules` reflection gate was tightened from `reflection.size() >= 50` to `reflection.matches('.*\\S.*') && reflection.size() >= 50` to close the whitespace bypass.

Scripts: `npm run test:rules` (vitest only) and `npm run test:rules:emulator` (starts emulator, runs suite, shuts down).
