# Add Submission Delete — Plan Brief

> Full plan: `context/changes/add-submission-delete/plan.md`

## What & Why

Add a "Delete" button to `SubmissionCard` so the submission author can remove their own submission from the feed. This closes the CRUD gap identified in the Builder Certificate readiness check — the app currently has Create and Read for Submission but no Update or Delete. The Firestore security rule already permits deletion by the author; the missing piece is purely the client-side UI and handler.

## Starting Point

`app/routes/challenges.tsx` already imports `deleteDoc` and `doc` (used for comment deletion at line 71) and already has the `mountedRef` guard pattern. The Firestore rule `allow delete: if isWhitelisted() && request.auth.uid == resource.data.authorUid` is live at `firestore.rules:29`. Nothing needs to change in the security layer.

## Desired End State

A "Delete" button appears in the `SubmissionCard` action row only for the author. Clicking it triggers `window.confirm()`; confirming calls `deleteDoc` on `submissions/{id}` and the card disappears from the feed immediately via the existing `onSnapshot` listener. Comments and follow-up submissions referencing the deleted parent are left in Firestore but become unreachable through the app.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Cascade delete comments subcollection | Leave in Firestore | Orphaned comments are unreachable via the app; at 5–15 members the storage cost is negligible and the implementation complexity is not worth it. | Plan |
| Orphaned follow-up submissions | Leave as invisible | `buildSubmissionTree` never renders children whose parent is absent from the null-bucket; no extra work required. | Plan |
| Confirmation UX | `window.confirm()` | Zero extra components or state; acceptable for a destructive action in a private 5–15-member app. | Plan |
| New unit tests | None | The delete handler has no domain logic to guard; the only assertion would be that `deleteDoc` was called — a mock-mirror anti-pattern the test plan explicitly warns against. | Plan |

## Scope

**In scope:**
- `deleteError` state in `SubmissionCard`
- `handleDeleteSubmission` async function with `window.confirm()` guard
- "Delete" button in the action row, visible only to `submission.authorUid`
- Inline error message on delete failure

**Out of scope:**
- Cascade deletion of `submissions/{id}/comments` subcollection
- Cascade deletion of follow-up submissions
- Styled confirmation modal
- New unit or integration tests
- Any Firestore security rule changes

## Architecture / Approach

Single-file change: `app/routes/challenges.tsx`, `SubmissionCard` component only. Mirror the existing `handleDelete(commentId)` pattern (lines 71–80). Three additions — state, function, button — following conventions already established in the file. The real-time listener handles the UI update on success automatically; no manual cleanup needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add delete handler and button | Author can delete their own submission via a confirm-guarded button | None significant — pure additive change following established patterns |

**Prerequisites:** No external dependencies; Firestore rule already in place.  
**Estimated effort:** ~1 session, single file.

## Open Risks & Assumptions

- Orphaned `comments` subcollection documents accumulate silently in Firestore. Acceptable at MVP scale; a future admin cleanup script could handle this.
- `window.confirm()` is not testable in Vitest/jsdom — this is explicitly accepted; the interaction is covered by manual testing.

## Success Criteria (Summary)

- "Delete" button appears only on the signed-in user's own submissions
- Clicking → confirming removes the submission from the feed in real time (no page reload)
- A non-author member sees no Delete button on other members' submissions
