# Add Submission Update (Edit Reflection) Implementation Plan

## Overview

Add an "Edit reflection" panel to `SubmissionCard` so the submission author can update their reflection text after posting. The Firestore update rule is already in place; this plan also hardens it with the same 50-char size guard that the create rule enforces, then wires the client-side UI following the established follow-up form pattern.

## Current State Analysis

`SubmissionCard` (`app/routes/challenges.tsx:25`) already manages three panel-style UI flows: Comments, Follow-Up, and Delete. Each shares the same pattern: state slots (`open`, `value`, `submitting`, `error`), a gate predicate in `app/lib/gatePredicates.ts`, and a form panel that renders below the action row when open.

**Key Discoveries:**

- The follow-up form (lines 192–281) is the direct template for the edit panel — same textarea, char counter, char gate, submit/cancel buttons.
- `gatePredicates.ts` exports `checkCanSubmit`, `checkCanFollowUp`, `checkCanPost`; a `checkCanEdit` fits the same shape.
- `firestore.rules` lines 26–28: the update rule permits author-only writes but does NOT enforce `reflection.size() >= 50`, unlike the create rule (lines 23–25).
- No `updateDoc` import exists anywhere in the codebase yet — this is the first update-path write.
- The `useChallengeSubmissions` hook uses a real-time Firestore listener, so the card automatically re-renders with the new reflection after `updateDoc` succeeds — no manual state patch needed.

## Desired End State

A submission author sees an "Edit" button in the action row of their own card. Clicking it opens a panel (and closes Comments/Follow-Up if open), pre-populated with the current reflection. The 50-char gate blocks saving until the threshold is met. On success, `updateDoc` writes the trimmed reflection to Firestore, the panel closes, and the card re-renders via the existing real-time listener. Non-authors see no Edit button.

### Key Discoveries:

- `app/routes/challenges.tsx:176` — the Delete button is the existing author-only guard pattern to mirror.
- `app/lib/gatePredicates.ts:17–28` — `checkCanFollowUp` is the exact function shape to replicate.
- `firestore.rules:26–28` — update rule needs `request.resource.data.reflection.size() >= 50` added.

## What We're NOT Doing

- Editing `photoUrl` — reflection-only update per the task spec.
- Adding an edit path for comments — Firestore rules explicitly mark comments as immutable.
- Adding server-side timestamp tracking for edits (`updatedAt` field) — not in scope.
- Any migration or backfill — existing reflections are unaffected.

## Implementation Approach

Two-phase: first harden the Firestore rule (server-side defense-in-depth), then add the client-side predicate + state + handler + UI in one cohesive component pass. The UI strictly mirrors the follow-up form pattern to keep the component consistent.

## Phase 1: Firestore Rule Hardening

### Overview

Add the 50-char minimum to the `update` rule for the `submissions` collection, matching the symmetry already present in the `create` rule.

### Changes Required:

#### 1. Submissions update rule

**File**: `firestore.rules`

**Intent**: Add `request.resource.data.reflection.size() >= 50` as a fourth condition on the existing `allow update` block, so a direct SDK call can't write a sub-50-char reflection even if the JS gate is bypassed.

**Contract**: The updated block becomes:
```
allow update: if isWhitelisted() &&
                request.auth.uid == resource.data.authorUid &&
                request.resource.data.authorUid == resource.data.authorUid &&
                request.resource.data.reflection.size() >= 50;
```

### Success Criteria:

#### Automated Verification:

- Rules deploy without error: `firebase deploy --only firestore:rules`

#### Manual Verification:

- Using the Firebase Console Firestore rules simulator: an update to a submission with a 49-char reflection is denied; a 50-char reflection is allowed for the author.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Predicate, Handler, and Edit Panel UI

### Overview

Add `checkCanEdit` to `gatePredicates.ts`, then wire state, handler, button, and form panel into `SubmissionCard`. Mirrors the follow-up form pattern exactly.

### Changes Required:

#### 1. `checkCanEdit` predicate

**File**: `app/lib/gatePredicates.ts`

**Intent**: Export a named gate predicate for the edit flow, keeping all gate logic in the one testable file.

**Contract**: `checkCanEdit(reflection: string, submitting: boolean): boolean` — returns true when `reflection.trim().length >= 50 && !submitting`. Same shape as `checkCanFollowUp`.

#### 2. Firestore import — add `updateDoc`

**File**: `app/routes/challenges.tsx`

**Intent**: Extend the existing `firebase/firestore` import with `updateDoc` so the handler can write the update.

**Contract**: Add `updateDoc` to the named imports at line 3–9.

#### 3. Predicate import

**File**: `app/routes/challenges.tsx`

**Intent**: Import `checkCanEdit` alongside the existing gate predicates.

**Contract**: Add `checkCanEdit` to the import from `~/lib/gatePredicates` at line 16.

#### 4. State slots in SubmissionCard

**File**: `app/routes/challenges.tsx`

**Intent**: Add the four state slots that drive the edit panel, following the same naming convention as the follow-up panel (`fu*` → `edit*`).

**Contract**: Four `useState` declarations after the existing `deleteError`/`isDeleting` pair (lines 41–42):
- `editOpen: boolean` — controls panel visibility
- `editReflection: string` — textarea value
- `editSubmitting: boolean` — disables button during async call
- `editError: string | null` — surfaces Firestore errors

#### 5. `canEdit` derived value

**File**: `app/routes/challenges.tsx`

**Intent**: Compute the gate check alongside `canPost` and `canFollowUp` (lines 44–45).

**Contract**: `const canEdit = checkCanEdit(editReflection, editSubmitting);`

#### 6. `handleEditReflection` async handler

**File**: `app/routes/challenges.tsx`

**Intent**: Submit the reflection update to Firestore, guard against unmounted state, and reset panel on success — same flow as `handleFollowUp`.

**Contract**: The handler calls `updateDoc(doc(db, "submissions", submission.id), { reflection: editReflection.trim() })`. On success: `setEditOpen(false)`, reset `editSubmitting`. On error: set `editError`. Always checks `mountedRef.current` before state writes.

#### 7. "Edit" button in action row

**File**: `app/routes/challenges.tsx`

**Intent**: Expose the Edit action to the submission author only, in the existing action row alongside the Delete button (lines 176–185).

**Contract**: An author-only `{user?.uid === submission.authorUid && (<button>)}` block. The click handler: sets `editReflection` to `submission.reflection` (pre-population), toggles `editOpen`, and sets `commentOpen` and `followUpOpen` to `false` (mutual exclusion). Label toggles between `"Edit"` and `"Cancel Edit"`. Styled identically to the Delete button but without `text-red-*` — use neutral `text-gray-500` to match the Comments button styling.

#### 8. Edit panel below the action row

**File**: `app/routes/challenges.tsx`

**Intent**: Render the edit form when `editOpen` is true, in the same slot and visual style as the follow-up form.

**Contract**: A `{editOpen && (<div>…</div>)}` block placed after the `deleteError` paragraph (line 188) and before the follow-up form block (line 191). Contents:
- `<form onSubmit={handleEditReflection}>` with `className="space-y-3"`
- A `<label>` + `<textarea>` bound to `editReflection` / `setEditReflection`, 3 rows, same Tailwind classes as `fuReflection` textarea (line 247)
- Character counter paragraph using the same conditional green/gray classes as lines 250–257
- `{editError && <p className="text-sm text-red-600 …">{editError}</p>}`
- Submit button (`disabled={!canEdit}`) with label `"Saving…"` / `"Save"`, Cancel button that resets `editOpen`, `editReflection`, `editError`

### Success Criteria:

#### Automated Verification:

- TypeScript type check passes: `npx tsc --noEmit`
- No lint errors: `npm run lint` (or equivalent)

#### Manual Verification:

- Logged-in author sees "Edit" button; other users do not.
- Clicking "Edit" closes Comments and Follow-Up panels if open and pre-populates the textarea with the current reflection.
- The char counter turns green at 50 chars; the Save button is disabled below 50.
- Saving successfully updates the reflection in the card (via real-time listener) and closes the panel.
- A Firestore error surfaces the inline error message and leaves the panel open.
- Clicking "Cancel Edit" resets state and closes the panel without writing to Firestore.
- No regressions in Comments, Follow-Up, or Delete flows.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign in as the submission author; verify "Edit" button appears on own cards.
2. Sign in as a different user; verify "Edit" button is absent on others' cards.
3. Open Comments, then click "Edit" — confirm Comments panel closes.
4. Open Follow-Up, then click "Edit" — confirm Follow-Up panel closes.
5. Edit panel opens with the current reflection pre-filled.
6. Clear the textarea or reduce to < 50 chars — confirm Save is disabled and counter is gray.
7. Enter ≥ 50 chars — confirm Save becomes enabled and counter is green.
8. Save — confirm panel closes and reflection updates in the card display.
9. Force a Firestore error (e.g., temporarily set rules to deny update) — confirm error message appears and panel stays open.
10. Click "Cancel Edit" — confirm no change to reflection, panel closes cleanly.

## References

- Follow-up form template: `app/routes/challenges.tsx:192–281`
- Gate predicate pattern: `app/lib/gatePredicates.ts`
- Firestore update rule: `firestore.rules:26–28`
- Submission type: `app/types/submission.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Firestore Rule Hardening

#### Automated

- [x] 1.1 Rules deploy without error: `firebase deploy --only firestore:rules` — f5ec250

#### Manual

- [x] 1.2 Firebase Console simulator: 49-char reflection update denied; 50-char allowed for author — f5ec250

### Phase 2: Predicate, Handler, and Edit Panel UI

#### Automated

- [x] 2.1 TypeScript type check passes: `npx tsc --noEmit`
- [x] 2.2 No lint errors: `npm run lint`

#### Manual

- [x] 2.3 Author sees "Edit" button; other users do not
- [x] 2.4 Opening Edit closes Comments and Follow-Up panels
- [x] 2.5 Edit panel pre-populates with current reflection
- [x] 2.6 50-char gate enforced: Save disabled below threshold, counter turns green at 50
- [x] 2.7 Save writes update and closes panel; card re-renders via real-time listener
- [x] 2.8 Firestore error surfaces inline error, leaves panel open
- [x] 2.9 Cancel clears state without writing to Firestore
- [x] 2.10 No regressions in Comments, Follow-Up, or Delete flows
