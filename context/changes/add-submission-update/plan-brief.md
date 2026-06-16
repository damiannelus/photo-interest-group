# Add Submission Update (Edit Reflection) — Plan Brief

> Full plan: `context/changes/add-submission-update/plan.md`

## What & Why

Add an "Edit reflection" flow to `SubmissionCard` so authors can correct or improve their reflection text after posting. This closes the CRUD gap: Create, Read, and Delete already exist; Update is the missing fourth operation required to pass the rubric.

## Starting Point

`SubmissionCard` (`app/routes/challenges.tsx:25`) already has three expandable panels (Comments, Follow-Up, Delete) and a shared gate predicate pattern in `gatePredicates.ts`. The Firestore `update` rule permits author-only writes but does not yet enforce the 50-char minimum. No `updateDoc` call exists anywhere in the codebase.

## Desired End State

A submission author sees an "Edit" button in the action row of their own card. Clicking it opens a textarea pre-populated with the current reflection (and closes any open Comments/Follow-Up panel). The 50-char gate blocks saving until met. On save, `updateDoc` writes the trimmed reflection; the existing real-time listener automatically re-renders the card with the new text. Non-authors see no Edit button.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Firestore update rule | Harden with `reflection.size() >= 50` | Matches create rule symmetry; prevents bypassed JS gate | Plan |
| Gate predicate location | Add `checkCanEdit` to `gatePredicates.ts` | All gate logic lives in one testable file — established pattern | Plan |
| Panel mutual exclusion | Opening Edit closes Comments + Follow-Up | Matches existing toggle behaviour; one panel open at a time | Plan |
| Edit panel placement | Button in action row, panel below | Direct mirror of Follow-Up form — zero new UX patterns | Plan |

## Scope

**In scope:**
- `firestore.rules` — add reflection size guard to `update` rule
- `app/lib/gatePredicates.ts` — add `checkCanEdit` export
- `app/routes/challenges.tsx` — `updateDoc` import, state slots, handler, button, form panel

**Out of scope:**
- Editing `photoUrl`
- Editing comments (intentionally immutable per existing rules comment)
- `updatedAt` timestamp tracking

## Architecture / Approach

Strictly follows the existing follow-up form pattern: local state slots → gate predicate → async handler with `mountedRef` guard → JSX panel rendered below the action row. The Firestore real-time subscription handles UI refresh automatically — no manual state patch after save.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Firestore Rule Hardening | `update` rule enforces ≥ 50-char reflection server-side | Must redeploy rules; Firebase CLI must be configured |
| 2. Predicate, Handler, and Edit Panel UI | Full client-side Edit flow in SubmissionCard | Correctly seeding `editReflection` from `submission.reflection` on panel open |

**Prerequisites:** Firebase CLI authenticated and rules deploy access; `npm` dev tooling installed.  
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The Firestore `update` rule currently allows writing any other fields (e.g., `photoUrl`) since it only checks `authorUid`. This plan does not add field-level guards beyond reflection size — acceptable given the narrow client-side scope.
- The real-time listener is assumed to be active when the card is visible; if a submission is viewed in a context without a live listener, the reflection won't auto-refresh post-save (no known case currently).

## Success Criteria (Summary)

- Author can edit and save a reflection of ≥ 50 chars; card updates in place via real-time listener.
- 50-char gate enforced both client-side (disabled Save button) and server-side (Firestore rule).
- Non-authors see no Edit button; Comments/Follow-Up/Delete flows are unaffected.
