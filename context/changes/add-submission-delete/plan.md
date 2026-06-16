# Add Submission Delete — Implementation Plan

## Overview

Add a "Delete" button to `SubmissionCard` so the submission author can remove their own submission. The Firestore security rule (`allow delete`) already exists. All changes are confined to a single file.

## Current State Analysis

- `deleteDoc` and `doc` are already imported in `app/routes/challenges.tsx` — used for comment deletion (`handleDelete`, lines 71–80). No new imports needed.
- Firestore rule at `firestore.rules:29` already permits `delete` on `submissions/{submissionId}` when `request.auth.uid == resource.data.authorUid`.
- `SubmissionCard` already has a `mountedRef` guard, a `submitError` state for comments, and an action-buttons row containing "Comments" and "Follow-Up" buttons — the Delete button slots into this row.
- `useChallengeSubmissions` uses `onSnapshot`; a successful delete will automatically remove the submission from the list, unmounting `SubmissionCard` — no manual state cleanup needed on success.

## Desired End State

A "Delete" button appears in the `SubmissionCard` action row only when the signed-in user is the submission author (`user?.uid === submission.authorUid`). Clicking it shows a `window.confirm()` prompt. On confirmation, `deleteDoc` is called on `submissions/{id}`; the card disappears from the feed immediately via the existing real-time listener. On cancellation or network failure, nothing changes (an error message appears on failure).

Comments in the `submissions/{id}/comments` subcollection and any follow-up submissions referencing the deleted parent are intentionally left in Firestore — orphaned comments are unreachable through the app, and orphaned follow-ups become invisible since `buildSubmissionTree` never renders children whose parent is absent from the null-bucket.

### Key Discoveries:

- `deleteDoc` and `doc` already imported — `app/routes/challenges.tsx:6-7`
- Existing comment delete pattern to mirror — `app/routes/challenges.tsx:71-80`
- Firestore delete rule already in place — `firestore.rules:29`
- `mountedRef` guard pattern established — `app/routes/challenges.tsx:27-28`

## What We're NOT Doing

- No cascade deletion of `submissions/{id}/comments` subcollection documents
- No cascade deletion of follow-up submissions that reference the deleted parent
- No styled inline confirmation UI — `window.confirm()` is sufficient at 5–15-member scale
- No new unit or integration tests — the delete handler contains no domain logic to guard; a test would only assert that `deleteDoc` was called (a mock-mirror anti-pattern per the test plan)
- No update to Firestore security rules — the rule already exists

## Implementation Approach

Mirror the existing `handleDelete(commentId)` pattern inside `SubmissionCard`. Add three things: a `deleteError` state, a `handleDeleteSubmission` function guarded by `window.confirm()`, and a "Delete" button in the action row visible only to the author. The real-time `onSnapshot` listener in `useChallengeSubmissions` handles the UI update on success automatically.

## Phase 1: Add delete handler and button in SubmissionCard

### Overview

All changes are inside `SubmissionCard` in `app/routes/challenges.tsx`. Three additions: error state, async handler, and a conditional "Delete" button in the existing action-buttons row.

### Changes Required:

#### 1. `deleteError` state

**File**: `app/routes/challenges.tsx`

**Intent**: Track and surface delete failures to the user without colliding with the existing `submitError` state (which belongs to the comment-post flow).

**Contract**: Add `const [deleteError, setDeleteError] = useState<string | null>(null)` alongside the existing state declarations in `SubmissionCard` (around line 34).

---

#### 2. `handleDeleteSubmission` function

**File**: `app/routes/challenges.tsx`

**Intent**: Let the author delete their own submission with a safety confirmation, using the existing `mountedRef` guard to suppress state updates after unmount.

**Contract**: Add an `async function handleDeleteSubmission()` in `SubmissionCard`, below `handleFollowUp`. The function must:
1. Call `window.confirm("Delete this submission? This cannot be undone.")` and return early if the user cancels.
2. Call `await deleteDoc(doc(db, "submissions", submission.id))`.
3. On failure: `console.error` the error, guard with `mountedRef.current`, and call `setDeleteError("Failed to delete. Please try again.")`.
4. No success-path state update needed — the `onSnapshot` listener unmounts the card automatically.

---

#### 3. Delete button and error display in the action row

**File**: `app/routes/challenges.tsx`

**Intent**: Surface the delete action only to the submission author, in the existing action-buttons row alongside "Comments" and "Follow-Up". Show the error inline below the row.

**Contract**: Inside the action-buttons `<div>` (around line 143), add a conditionally rendered `<button>` after the "Follow-Up" button:
- Rendered only when `user?.uid === submission.authorUid`
- `type="button"`, `onClick={handleDeleteSubmission}`
- Label: "Delete"
- Style: match the existing text-button pattern (`text-xs text-red-500 hover:text-red-700`)

Below the action-buttons `<div>`, add a conditionally rendered error paragraph:
- Rendered only when `deleteError` is non-null
- Style: match the existing error pattern (`text-sm text-red-600 dark:text-red-400`)

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npm run typecheck`

#### Manual Verification:

- As the submission author, a "Delete" button is visible in the action row of your own submission
- Clicking "Delete" shows a browser confirm dialog with the specified message
- Confirming removes the submission from the feed immediately (no page reload)
- Cancelling the dialog leaves the submission unchanged
- As a non-author member, no "Delete" button appears on another user's submission
- If delete fails (simulate by temporarily revoking Firestore permissions), the error message appears below the action buttons and the submission remains in the feed

**Implementation Note**: After completing automated verification, pause for manual confirmation before marking this phase done. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in the `## Progress` section below.

---

## Testing Strategy

### Unit Tests:

None for this change — the delete handler contains no extractable domain logic. The `deleteDoc` call path is verified by manual testing.

### Manual Testing Steps:

1. Sign in as a whitelisted member. Create a submission.
2. Confirm the "Delete" button appears on your own submission and not on another member's submission.
3. Click "Delete", then click "Cancel" in the browser dialog — verify nothing changes.
4. Click "Delete", then click "OK" — verify the submission disappears from the feed immediately.
5. Submit a follow-up to a different submission, then delete the parent — verify the follow-up becomes invisible without errors in the console.
6. (Optional) Temporarily force a Firestore error to verify the error message renders.

## References

- Existing comment delete pattern: `app/routes/challenges.tsx:71–80`
- Firestore delete rule: `firestore.rules:29`
- `mountedRef` guard pattern: `app/routes/challenges.tsx:27–28`
- Lessons: `context/foundation/lessons.md` (trim-consistency — not applicable here, no gated textarea involved)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add delete handler and button in SubmissionCard

#### Automated

- [x] 1.1 TypeScript compiles without errors: `npm run typecheck`

#### Manual

- [x] 1.2 Delete button visible only to the submission author
- [x] 1.3 Confirm dialog shown on click; cancel leaves submission unchanged
- [x] 1.4 Confirming removes submission from feed immediately
- [x] 1.5 No Delete button visible on another member's submission
- [x] 1.6 Error message renders on delete failure; submission remains in feed
