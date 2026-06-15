# Submission Comments Implementation Plan (S-04)

## Overview

Add the ability for whitelisted members to post text comments on any submission and view all existing comments. Comments live in the `/submissions/{submissionId}/comments/{commentId}` subcollection defined in the F-03 data model. Each submission card gets a collapsible "Comments (N)" toggle button; expanding it reveals the thread (oldest first) and a comment form at the bottom. Comment authors can delete their own comments. This is entirely a UI addition — Firestore security rules, data model, and auth infrastructure are 100% in place.

## Current State Analysis

- `app/routes/challenges.tsx` — `ChallengeCard` renders each challenge with a real-time submissions list; submissions are rendered inline as a `.map()` over `submissions[]` state. No comment section or TODO markers for S-04 exist — the comment UI will be added via a new `SubmissionCard` child component extracted from this rendering.
- `firestore.rules` (deployed) — The comments subcollection rules are live: `allow read: if isWhitelisted()`, `allow create: if isWhitelisted() && request.auth.uid == request.resource.data.authorUid`, `allow delete: if isWhitelisted() && request.auth.uid == resource.data.authorUid`. No update rule — comments are immutable.
- `firestore.indexes.json` — Two composite indexes deployed (submissions, challenges). No index needed for comments: a single `orderBy("createdAt", "asc")` on the subcollection uses Firestore's automatic single-field index.
- `app/types/comment.ts` — Does not exist. Must be created.
- `app/types/submission.ts` — Submission type fully defined; no changes needed.
- `app/firebase.ts` — Exports `db`. Modular v12 Firebase SDK API is the established pattern throughout.
- `useAuth()` — Available inside `_protected` children; returns guaranteed non-null `user` in practice.

## Desired End State

A whitelisted member viewing the feed can:
1. See a "Comments (N)" button on every submission card, where N reflects the current comment count (fetched on card mount via `getCountFromServer`).
2. Click the button to expand the comment section inline below the submission; see all comments in chronological order (oldest first).
3. Post a comment of at least 10 characters using the form at the bottom of the expanded section; it appears in the thread immediately.
4. See a trash icon on their own comments; clicking it permanently deletes the comment.
5. Collapse the section by clicking the toggle again.

A comment cannot be posted unless it contains at least 10 non-whitespace characters — enforced client-side (disabled Post button) and server-side (Firestore does not enforce a minimum length on the write, but the client gate prevents empty or trivial posts).

### Key Discoveries

- `getCountFromServer` is available from `"firebase/firestore"` (SDK v12 modular) — returns an aggregate count without fetching documents; appropriate for populating the count badge on mount before the listener is opened.
- Once the toggle is opened, the `onSnapshot` listener returns all comment documents; updating `commentCount` from `snapshot.size` inside the listener keeps the badge in sync in real-time without maintaining two separate subscriptions.
- `deleteDoc` from `"firebase/firestore"` is the correct primitive for author delete; no Firestore rule changes needed.
- Comments are authored by the signed-in member; `user.uid` and `user.email` are read from `useAuth()` inside the new `SubmissionCard` component (same pattern as `ChallengeCard` for submissions).
- Extracting `SubmissionCard` from `ChallengeCard`'s inline `.map()` rendering is the cleanest way to isolate per-submission comment state; `ChallengeCard` already demonstrates this pattern (it was extracted from `ChallengeFeed` for the same reason — each card needed its own isolated Firestore listener).

## What We're NOT Doing

- No comment editing — Firestore rules have no `allow update` for comments; immutability is by design.
- No delete confirmation dialog — direct delete; the group is small and trusted.
- No comment minimum enforced server-side — Firestore rules enforce authorship but not content length; the 10-character gate lives in the client `canPost` guard only.
- No Firestore rule changes — existing rules fully cover the comment create and delete operations.
- No Firestore index changes — single-field `orderBy("createdAt")` on the comments subcollection uses the automatic index.
- No new routes — comments are inline on existing submission cards; no `/submissions/:id` detail page.
- No pagination — at 5–15 members and early MVP, comment counts per submission are trivially small.
- No real-time count without expansion — the initial count badge comes from `getCountFromServer` on mount; once the section is opened the live snapshot takes over.
- No comment threading / replies — flat list only.

## Implementation Approach

Three phases in dependency order:

1. **Comment type** — Create `app/types/comment.ts` with the Comment interface matching the F-03 data model schema.
2. **SubmissionCard + core comments** — Extract submission item rendering from `ChallengeCard` into a `SubmissionCard` child component; wire the count badge (`getCountFromServer` on mount), lazy comment listener (`onSnapshot` on toggle-open), comment list, comment form (10-char min, `addDoc`), and author delete (`deleteDoc`).
3. **Polish + error states** — Loading indicator on first expand, empty state, submit/delete error messaging, Tailwind dark mode consistency, mobile layout verification.

## Critical Implementation Details

**Count + snapshot coexistence**: `commentCount` state is seeded by the `getCountFromServer` async call on mount. Once `commentOpen` becomes `true` and the `onSnapshot` fires, set `commentCount` from `snapshot.size` inside the snapshot callback — this overwrites the aggregate value and keeps the badge live from that point forward. Never maintain two simultaneous subscriptions; the snapshot callback is the single source of truth once expanded.

**`SubmissionCard` cleanup**: The `onSnapshot` unsubscribe must run when `SubmissionCard` unmounts AND when `commentOpen` is set back to `false`. Wire the unsub via a `useEffect` that depends on `[commentOpen]`: when `commentOpen` transitions to `false`, the effect cleanup calls `unsub()` and the next render starts fresh. This prevents stale listeners accumulating if a user repeatedly toggles a submission.

---

## Phase 1: Comment Type

### Overview

Create the TypeScript type for a `comments` subcollection document. This is the only prerequisite for Phase 2 and establishes the contract other components will import.

### Changes Required

#### 1. Create `app/types/comment.ts`

**File**: `app/types/comment.ts` (new)

**Intent**: Define the TypeScript interface for a `/submissions/{id}/comments/{commentId}` Firestore document. Phase 2 imports `Comment` from this file.

**Contract**: Export a `Comment` interface with fields: `id: string` (Firestore document ID, added client-side), `text: string`, `authorUid: string`, `authorEmail: string`, `createdAt: Timestamp`. Import `Timestamp` from `"firebase/firestore"`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- No manual steps required for this phase — proceed directly to Phase 2.

---

## Phase 2: SubmissionCard + Core Comment Feature

### Overview

Extract the submission item rendering from `ChallengeCard` into a `SubmissionCard` child component. `SubmissionCard` owns all per-submission comment state and the Firestore data operations for comments. After this phase, the full comment flow works end-to-end.

### Changes Required

#### 1. Update imports in `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx`

**Intent**: Add the Firestore primitives and the Comment type that `SubmissionCard` needs.

**Contract**: Add `deleteDoc`, `doc`, `getCountFromServer` to the existing `"firebase/firestore"` import (alongside `addDoc`, `collection`, `onSnapshot`, `orderBy`, `query`, `serverTimestamp`, `where`). Add `import type { Comment } from "~/types/comment"`.

#### 2. Create `SubmissionCard` component inside `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx` (new component, same file)

**Intent**: Isolate all per-submission state (display, comment count, comment list, comment form) into a single component whose lifecycle React manages automatically.

**Contract**:
- Define `SubmissionCard` above `ChallengeCard` in the file.
- Props: `submission: Submission`.
- Call `useAuth()` at the top to get `user`.
- State variables:
  - `commentOpen: boolean` — starts `false`
  - `commentCount: number` — starts `0`
  - `comments: Comment[]` — starts `[]`
  - `commentsLoading: boolean` — starts `false`
  - `commentText: string` — starts `""`
  - `submitting: boolean` — starts `false`
  - `submitError: string | null` — starts `null`
- Derived constant: `const canPost = commentText.trim().length >= 10 && !submitting`
- On mount, fetch initial count:
  ```ts
  useEffect(() => {
    getCountFromServer(collection(db, "submissions", submission.id, "comments"))
      .then((snap) => setCommentCount(snap.data().count));
  }, [submission.id]);
  ```
- When `commentOpen` changes, wire/unwire the listener:
  ```ts
  useEffect(() => {
    if (!commentOpen) return;
    setCommentsLoading(true);
    const q = query(
      collection(db, "submissions", submission.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
      setCommentCount(snap.size);
      setCommentsLoading(false);
    });
    return unsub;
  }, [commentOpen, submission.id]);
  ```
- `handlePost`: `e.preventDefault()`, early-return if `!canPost || !user`. Set `submitting(true)`, `submitError(null)`. Call `addDoc(collection(db, "submissions", submission.id, "comments"), { text: commentText.trim(), authorUid: user.uid, authorEmail: user.email ?? "", createdAt: serverTimestamp() })`. On resolve: reset `commentText("")`, `submitting(false)`. On catch: set `submitError("Failed to post. Please try again.")`, `submitting(false)`.
- `handleDelete(commentId: string)`: Call `deleteDoc(doc(db, "submissions", submission.id, "comments", commentId))`. On catch: the live snapshot will not update — surface error via a transient `submitError` state or console (acceptable for MVP).
- JSX structure:
  - Render the existing submission display (photo, author email, reflection excerpt — migrated from the `ChallengeCard` `.map()` block).
  - Below the submission display, render the toggle button: `<button onClick={() => setCommentOpen(v => !v)}>Comments ({commentCount})</button>`.
  - When `commentOpen`: render a comment section containing: loading indicator (when `commentsLoading`), the comment list (when `!commentsLoading`), and the comment form at the bottom.
  - Comment list: each comment shows `authorEmail`, `text`, formatted timestamp, and a trash icon button if `comment.authorUid === user?.uid` (calls `handleDelete(comment.id)`).
  - Comment form: `<form onSubmit={handlePost}>`, a `<textarea>` bound to `commentText`/`setCommentText`, a character counter `{commentText.length} / 10 characters`, `{submitError && <p className="text-red-600 ...">...</p>}`, and a Post button `disabled={!canPost}`.

#### 3. Replace inline submission rendering in `ChallengeCard` with `<SubmissionCard>`

**File**: `app/routes/challenges.tsx` — inside `ChallengeCard`

**Intent**: Replace the existing `.map()` over `submissions` with `<SubmissionCard>` instances so each submission renders via the new component.

**Contract**: In `ChallengeCard`'s JSX, replace the inline submission item block inside the `.map((sub) => ...)` call with `<SubmissionCard key={sub.id} submission={sub} />`. The submission display markup (photo, author, reflection) moves into `SubmissionCard` — do not leave a duplicate in `ChallengeCard`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Sign in as a whitelisted member → visit `/` → submission cards show "Comments (0)" toggle button below each submission
- Click the toggle → comment section expands; shows loading indicator briefly, then "No comments yet — be the first to respond." (Phase 3 adds this; Phase 2 may show an empty list)
- Type fewer than 10 characters in the comment textarea → "Post" button is disabled
- Type 10+ characters → "Post" button becomes enabled
- Click "Post" → comment appears in the list; "Comments (1)" updates in the toggle button
- Open two browser tabs → post a comment in one → it appears in the other tab's expanded comment section without refresh
- Click the toggle again → comment section collapses; "Comments (1)" count remains on the button
- The existing submission display (photo, author email, reflection) is unchanged

**Implementation Note**: Pause here and verify the end-to-end comment flow (post → appears in list → count updates) before proceeding to Phase 3.

---

## Phase 3: Polish + Error States

### Overview

Add loading and empty states, finalize error messaging, and ensure Tailwind dark mode and mobile layout are consistent with the rest of `challenges.tsx`.

### Changes Required

#### 1. Loading indicator in `SubmissionCard`

**File**: `app/routes/challenges.tsx` — `SubmissionCard` JSX

**Intent**: While the initial comment snapshot is loading after the toggle is opened, show a brief loading message.

**Contract**: When `commentsLoading === true`, render `<p className="text-sm text-gray-400 dark:text-gray-500 py-2">Loading comments…</p>` in place of the comment list.

#### 2. Empty state in `SubmissionCard`

**File**: `app/routes/challenges.tsx` — `SubmissionCard` JSX

**Intent**: When a submission has no comments, show a helpful prompt rather than a blank space.

**Contract**: When `!commentsLoading && comments.length === 0`, render `<p className="text-sm text-gray-400 dark:text-gray-500 py-2 italic">No comments yet — be the first to respond.</p>`.

#### 3. Character counter color transition

**File**: `app/routes/challenges.tsx` — character counter `<p>` in `SubmissionCard`

**Intent**: Give visual feedback when the comment minimum is met.

**Contract**: Apply a conditional class on the counter: below 10 chars: `text-xs text-gray-400 dark:text-gray-500`; at or above 10 chars: `text-xs text-green-600 dark:text-green-400`.

#### 4. Tailwind layout and styling for the comment section

**File**: `app/routes/challenges.tsx` — `SubmissionCard` JSX

**Intent**: Match the Tailwind v4 styling established in `challenges.tsx` for the existing form elements and layout.

**Contract**:
- Comment section wrapper (when open): `mt-3 pt-3 border-t border-gray-100 dark:border-gray-800`
- Toggle button: `text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-2` (secondary, not a primary action — no filled background)
- Comment item: `flex flex-col gap-0.5 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0`
- Comment author: `text-xs font-medium text-gray-700 dark:text-gray-300`
- Comment text: `text-sm text-gray-800 dark:text-gray-100`
- Comment timestamp: `text-xs text-gray-400 dark:text-gray-500`
- Delete button: `text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 ml-auto`
- Comment form textarea: same input class pattern as existing form elements in `challenges.tsx` (`w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 ...`)
- Post button (enabled): `bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded`

#### 5. `SubmissionCard` dark mode verification

**File**: `app/routes/challenges.tsx` — `SubmissionCard`

**Intent**: Confirm that the migrated submission display (photo, author, reflection) retains correct dark mode styling after extraction from `ChallengeCard`.

**Contract**: Verify the class names on the migrated submission display elements include all `dark:` variants that were present in the original `ChallengeCard` inline rendering. No new styles needed — this is a consistency check only.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Loading indicator appears briefly on first comment section expand, then transitions to the list
- Submission with no comments shows "No comments yet — be the first to respond."
- Character counter is gray below 10 chars and turns green at exactly 10 chars
- "Post" button shows "Posting…" during submission and is un-clickable
- All comment section elements have correct dark mode styling (dark backgrounds, lighter text) when OS is in dark mode
- Comment section and form are readable and usable at 375px mobile width
- Delete button (trash icon) is visible only on comments the signed-in user authored; clicking it removes the comment and updates the count in the toggle button
- No regressions in the existing submission display (photo, author email, reflection excerpt) or the submission form (Submit Photo toggle, photo URL input, reflection textarea, Publish button)

**Implementation Note**: This is the final phase. After manual verification passes, S-04 is complete and ready for commit.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in as a whitelisted member → visit `/` → every submission card shows "Comments (0)" toggle button
2. Click "Comments (0)" on a submission with no comments → section expands showing "No comments yet" empty state and comment form
3. Type 9 characters in the textarea → "Post" button is disabled; counter shows "9 / 10 characters" (gray)
4. Type one more character → "Post" button enables; counter turns green
5. Click "Post" → comment appears in the list; toggle button updates to "Comments (1)"
6. Open two browser tabs → post a comment in one → it appears in the other without a refresh
7. Post a second comment → order is chronological (oldest first)
8. Click the trash icon on your own comment → comment disappears; count updates to "Comments (1)"
9. Verify trash icon does NOT appear on another member's comments (test by seeding a comment with a different authorUid directly in Firebase Console)
10. Collapse the section → reopen → live listener reactivates, shows current comment count
11. Resize to mobile (375px) → comment section is readable and usable
12. Toggle OS dark mode → all comment section elements use dark backgrounds and lighter text
13. Server-side gate test: from DevTools console, attempt `addDoc(collection(db, "submissions", "<id>", "comments"), { text: "hi", authorUid: "wrong-uid", authorEmail: "x@x.com", createdAt: serverTimestamp() })` → expect `FirebaseError: Missing or insufficient permissions` (authorUid mismatch)

### Edge Cases

- Submission with no comments → empty state shown on first expand
- Very long comment text → wraps within the card; no overflow
- Comment posted by member whose display name has special characters → renders correctly
- `SubmissionCard` unmounts (user navigates away) with comment section open → `onSnapshot` unsubscribes cleanly (verify in browser DevTools Network tab — no ongoing Firestore WebSocket frames for that submission)
- `getCountFromServer` fails (offline at mount) → `commentCount` stays 0 on the button; toggle still works; once online the snapshot corrects the count

## Performance Considerations

At 5–15 members and MVP scale, comment volumes per submission will be small (single digits). The lazy `onSnapshot` strategy keeps concurrent Firestore listeners to the minimum needed (one per actively-expanded submission). `getCountFromServer` is a lightweight aggregate read (not counted toward Firestore document reads at the same rate as `getDocs` — it uses Firestore's aggregation quota). No memoization or virtual scrolling is required.

## Migration Notes

No data migration. No schema changes. The `/submissions/{id}/comments` subcollection is defined and rules-protected from F-03; this plan only adds client UI to read from and write to it.

## References

- PRD: `context/foundation/prd.md` — FR-011, FR-012
- Roadmap S-04: `context/foundation/roadmap.md`
- Firestore schema + rules source: `context/archive/2026-06-15-firestore-schema-and-rules/plan.md`
- Component extraction pattern: `context/archive/2026-06-15-challenge-submission-feed/plan.md` — how `ChallengeCard` was extracted from `ChallengeFeed`
- Form pattern to follow: `app/routes/challenges.tsx` (existing `ChallengeCard` submission form)
- Component to modify: `app/routes/challenges.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Comment Type

#### Automated

- [x] 1.1 `npm run typecheck` exits 0 — 328524d
- [x] 1.2 `npm run build` exits 0 — 328524d

### Phase 2: SubmissionCard + Core Comment Feature

#### Automated

- [x] 2.1 `npm run typecheck` exits 0 — b6e6894
- [x] 2.2 `npm run build` exits 0 — b6e6894

#### Manual

- [x] 2.3 Submission cards show "Comments (0)" toggle button below each submission — b6e6894
- [x] 2.4 Toggle expands comment section; "Post" disabled with <10 chars; enabled at ≥10 — b6e6894
- [x] 2.5 Posting a comment writes to Firestore and appears in the list without page refresh — b6e6894
- [x] 2.6 Comment count in toggle button updates after posting — b6e6894
- [x] 2.7 Real-time: comment posted in one tab appears in another without refresh — b6e6894
- [x] 2.8 Collapsing and reopening the toggle works; existing submission display unchanged — b6e6894

### Phase 3: Polish + Error States

#### Automated

- [x] 3.1 `npm run typecheck` exits 0
- [x] 3.2 `npm run build` exits 0

#### Manual

- [x] 3.3 Loading indicator appears briefly on first expand then transitions to comment list
- [x] 3.4 Empty state "No comments yet — be the first to respond." shown when no comments
- [x] 3.5 Character counter turns green at exactly 10 chars
- [x] 3.6 Delete button visible only on own comments; click removes comment and updates count
- [x] 3.7 Dark mode styles correct on all comment section elements
- [x] 3.8 Comment section readable and usable at 375px mobile width
- [x] 3.9 No regressions in submission display or submission form
