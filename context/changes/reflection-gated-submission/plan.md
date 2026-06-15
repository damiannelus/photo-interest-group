# Reflection-Gated Photo Submission Implementation Plan

## Overview

Add the submission form to the main feed. A "Submit Photo" button on each ChallengeCard expands an inline form with a photo URL field and a reflection textarea. The "Publish" button is disabled until both a valid photo URL and a reflection of at least 50 characters are present. On publish, the submission is written to Firestore (which enforces the gate server-side) and appears in the card's real-time feed instantly via the existing `onSnapshot` listener. This is the north star slice — the smallest end-to-end proof that the reflection gate works and cannot be bypassed.

## Current State Analysis

- `app/routes/challenges.tsx` — `ChallengeCard` already renders each challenge with a real-time submissions list; two `TODO S-02` markers sit at exactly where the submit button belongs (line 61 in the card header, line 88 in the empty state)
- `app/types/submission.ts` — `Submission` interface fully defined; all fields needed for S-02 are present
- `firestore.rules` (deployed) — `allow create: if isWhitelisted() && request.auth.uid == request.resource.data.authorUid && request.resource.data.reflection.size() >= 50` — server-side gate is live and enforced
- `app/routes/challenges.new.tsx` (S-05) — the exact pattern to follow: `useState` fields, `canSubmit` gate, `addDoc` + `serverTimestamp()`, reset on success
- `useAuth()` is available inside `_protected.tsx` children and returns a guaranteed non-null `user` in practice; `user.uid` and `user.email` populate the author fields
- No new route, Firestore index, or security rule change is needed — S-02 is entirely a UI addition on top of complete infrastructure

## Desired End State

A whitelisted member on the feed can click "Submit Photo" on any active challenge, fill in a hosted image URL and a reflection of at least 50 characters, and click "Publish". The submission appears immediately in the challenge card's submission list without any page navigation or refresh. A photo cannot be published without a non-empty `reflection` of at least 50 characters — enforced client-side (disabled button) and server-side (Firestore rule rejects the write).

### Key Discoveries

- `ChallengeCard` in `challenges.tsx` already imports `onSnapshot`, `where`, `orderBy` — needs `addDoc`, `serverTimestamp` added to the `firebase/firestore` import
- `useAuth` is **not** currently imported in `challenges.tsx` — must be added for `ChallengeCard` to get `user.uid` / `user.email`
- The "Submit Photo" button goes in the **card header only** (line 61 TODO); the empty-state TODO (line 88) becomes just informational text — one toggle per card prevents form state conflict
- `onSnapshot` in `ChallengeCard` subscribes to `where("challengeId", "==", challenge.id)` — a new submission with that `challengeId` will appear in the list within milliseconds of the `addDoc` resolving, with no extra wiring
- `parent_submission_id: null` for all S-02 submissions (S-03 sets the non-null case)
- The challenges query in `challenges.tsx` currently uses `where("status", "==", "active")` — the `(status ASC, createdAt DESC)` composite index was added in S-05 so this now works correctly

## What We're NOT Doing

- No new route (`/challenges/:id/submit`) — the form is inline within `ChallengeCard`
- No modal overlay — inline expand is sufficient and simpler
- No toast notification on success — the appearing submission in the feed IS the confirmation
- No photo URL validation beyond non-empty (no HTTP check, no image MIME check) — broken images show browser's default icon, accepted for MVP per F-03 precedent
- No edit or delete of submitted photos — Firestore rules allow it but no UI is built in this slice
- No `parent_submission_id` linking — that is S-03
- No comments display — that is S-04
- No Firestore rule changes — rules already enforce the 50-char gate

## Implementation Approach

Two phases:

1. **Core submission form** — add `useAuth` import and form state to `ChallengeCard`; replace the `TODO S-02` header slot with a "Submit Photo" toggle button; render the inline form with photo URL input + live preview + reflection textarea + character counter + Publish button; wire the `addDoc` write and form reset on success.
2. **Polish + error states** — add character counter color transition (neutral → green at ≥50), "Publishing…" loading label on the button, submit error message on `addDoc` failure, and verify mobile layout and dark mode styles are consistent with the rest of `ChallengeCard`.

## Critical Implementation Details

**`useAuth()` in `ChallengeCard`**: `user` is guaranteed non-null for any component inside `_protected.tsx`, but TypeScript types it as `User | null`. Mirror the S-05 pattern: early-return `if (!user) return;` inside the submit handler — not as a render guard, just as a runtime safety net.

**`addDoc` import**: `challenges.tsx` currently imports `collection`, `onSnapshot`, `orderBy`, `query`, `where` from `"firebase/firestore"`. Add `addDoc` and `serverTimestamp` to that same import.

**Form state isolation**: Each `ChallengeCard` instance owns its own `formOpen`, `photoUrl`, `reflection`, `submitting`, `submitError` state. Multiple cards can each have their own form state independently — no lifting to the parent needed.

---

## Phase 1: Core Submission Form

### Overview

Replace the `TODO S-02` header slot in `ChallengeCard` with a "Submit Photo" toggle button and inline form. Wire the `addDoc` write and form reset. After this phase, the end-to-end submission flow works.

### Changes Required

#### 1. Update imports in `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx`

**Intent**: Add the Firebase write primitives and the auth hook that `ChallengeCard` needs to submit a photo.

**Contract**: Add `addDoc`, `serverTimestamp` to the existing `firebase/firestore` import. Add `import { useAuth } from "~/context/auth"` alongside the existing imports.

#### 2. Add form state to `ChallengeCard`

**File**: `app/routes/challenges.tsx` — inside `ChallengeCard`

**Intent**: Track whether the inline form is open and hold its field values, submission progress, and any error.

**Contract**: Add five state variables inside `ChallengeCard` (after the existing `submissions`, `subsLoading`, `subsError` state):
- `formOpen: boolean` — starts `false`; toggled by the "Submit Photo" button
- `photoUrl: string` — starts `""`
- `reflection: string` — starts `""`
- `submitting: boolean` — starts `false`; set true during `addDoc`
- `submitError: string | null` — starts `null`

Add a derived constant (not state): `const canPublish = photoUrl.trim().length > 0 && reflection.trim().length >= 50 && !submitting`

#### 3. Add submit handler to `ChallengeCard`

**File**: `app/routes/challenges.tsx` — inside `ChallengeCard`

**Intent**: Write the submission document to Firestore and reset the form on success.

**Contract**: Call `useAuth()` at the top of `ChallengeCard` to get `user`. Add an `async function handleSubmit(e: React.FormEvent)` that:
1. Calls `e.preventDefault()` and early-returns if `!canPublish || !user`
2. Sets `submitting(true)` and `submitError(null)`
3. Calls `addDoc(collection(db, "submissions"), { challengeId: challenge.id, photoUrl: photoUrl.trim(), reflection: reflection.trim(), authorUid: user.uid, authorEmail: user.email ?? "", createdAt: serverTimestamp(), parent_submission_id: null })`
4. On resolve: resets `photoUrl`, `reflection`, `submitting` to defaults and sets `formOpen(false)`
5. On catch: sets `submitError("Failed to publish. Please try again.")` and sets `submitting(false)`

#### 4. Replace the header TODO with a "Submit Photo" button

**File**: `app/routes/challenges.tsx` — `ChallengeCard` JSX, challenge header section

**Intent**: Replace `{/* TODO S-02: SubmitPhotoButton goes here */}` in the card header with a button that toggles `formOpen`.

**Contract**: Replace the comment with a `<button>` that calls `setFormOpen((v) => !v)`. Label: `formOpen ? "Cancel" : "Submit Photo"`. Style to match the existing "+ New Challenge" button in the feed header (blue filled when opening, neutral/outline when cancelling — or simply toggle the label; style details in Phase 2).

#### 5. Remove the empty-state TODO comment

**File**: `app/routes/challenges.tsx` — `ChallengeCard` JSX, empty state section

**Intent**: The inline form is on the card header; the empty state just needs its informational text. Remove `{/* TODO S-02: SubmitPhotoButton goes here */}` from the empty-state `<p>` tag to clean up the placeholder.

**Contract**: Delete the comment. The text "No submissions yet — be the first!" remains.

#### 6. Add the inline form to `ChallengeCard`

**File**: `app/routes/challenges.tsx` — `ChallengeCard` JSX

**Intent**: When `formOpen` is true, render the submission form below the challenge header and above the submissions list.

**Contract**: Conditionally render a `<form onSubmit={handleSubmit}>` block when `formOpen`. The form contains:

- **Photo URL field**: `<input type="url">` bound to `photoUrl` / `setPhotoUrl`. Label: "Photo URL". Required attribute present. Placeholder: "Paste a hosted image URL".
- **Photo preview**: Rendered below the input when `photoUrl.trim().length > 0` as `<img src={photoUrl} alt="Preview" className="..." />`. A small thumbnail (e.g., `w-full max-h-48 object-cover rounded mt-2`). Broken URLs show the browser's broken-image icon — no extra handling.
- **Reflection field**: `<textarea>` bound to `reflection` / `setReflection`, `rows={4}`. Label: "Reflection". No `minLength` HTML attribute — gate is enforced via `canPublish` and Firestore rules.
- **Character counter**: `<p>` below the textarea showing `{reflection.length} / 50 characters`. Color styling in Phase 2.
- **Submit error**: `{submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}`
- **Actions row**: "Publish" button (`type="submit"`, `disabled={!canPublish}`) and a "Cancel" `<button type="button">` that calls `setFormOpen(false)`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Sign in as a whitelisted member → click "Submit Photo" on a challenge card → inline form expands below the header
- With both an empty URL and a short reflection, "Publish" button is disabled
- Paste a valid image URL → photo preview appears below the input
- Type fewer than 50 characters in the reflection → button remains disabled
- Type 50+ characters in the reflection AND a non-empty URL → "Publish" button becomes enabled
- Click Publish → button shows "Publishing…", then form collapses; the new submission appears in the card's submission list within ~1 second (no page refresh)
- Click "Cancel" → form collapses without submitting; existing submissions unchanged

**Implementation Note**: Pause here and verify the end-to-end flow manually (sign in → submit → see in feed) before proceeding to Phase 2. This confirms the reflection gate and real-time update both work before adding polish.

---

## Phase 2: Polish + Error States

### Overview

Finalize the form's visual quality: character counter color feedback, loading state on the button, consistent Tailwind dark mode styles on all form elements, and mobile layout verification.

### Changes Required

#### 1. Character counter color transition

**File**: `app/routes/challenges.tsx` — character counter `<p>` element

**Intent**: Give the user positive feedback when the reflection threshold is met.

**Contract**: Apply a conditional class on the counter `<p>`:
- Below 50 chars: `text-sm text-gray-400 dark:text-gray-500`
- At or above 50 chars: `text-sm text-green-600 dark:text-green-400`

Use an inline conditional: `className={reflection.length >= 50 ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-gray-400 dark:text-gray-500"}`

#### 2. Button loading state

**File**: `app/routes/challenges.tsx` — Publish button

**Intent**: Communicate that the write is in progress so the user doesn't double-click.

**Contract**: Set button label to `submitting ? "Publishing…" : "Publish"`. Button is already `disabled={!canPublish}` — when `submitting` is true, `canPublish` is false (it includes `&& !submitting`), so the button is automatically disabled during the write.

#### 3. Form element dark mode + Tailwind styling

**File**: `app/routes/challenges.tsx` — inline form elements

**Intent**: Match the styling established in `challenges.new.tsx` so the form looks consistent with the rest of the app.

**Contract**: Apply the same input/textarea class pattern used in `challenges.new.tsx`:
- Inputs and textarea: `w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`
- Publish button (enabled): `bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded`
- Cancel button: `text-sm text-gray-500 dark:text-gray-400 hover:underline`
- Form wrapper: `border-t border-gray-100 dark:border-gray-800 mt-4 pt-4 space-y-4`
- Labels: `block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1`

#### 4. Submit Photo toggle button styling

**File**: `app/routes/challenges.tsx` — the header toggle button

**Intent**: The button should read clearly as an action affordance, and shift appearance when it becomes a "Cancel" (destructive-secondary).

**Contract**: When `!formOpen`: `bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded`. When `formOpen`: `text-sm text-gray-500 dark:text-gray-400 hover:underline`. Toggle via conditional class.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Character counter is gray below 50 chars and turns green at exactly 50 chars
- "Publish" button label changes to "Publishing…" during submission and button is un-clickable
- All form inputs have correct dark mode styling (dark background, light text) when OS is in dark mode
- Form layout is readable and usable at 375px mobile width (inputs full-width, no overflow)
- Attempting `addDoc` with a malformed/unreachable URL still writes successfully (photo rendering is the client's responsibility, not the write)
- Browser DevTools console shows no errors during normal form interaction or submission
- Simulate a Firestore write rejection by temporarily shortening reflection to <50 chars via DevTools before submit → `submitError` message appears; form stays open

**Implementation Note**: This is the final phase. After manual verification passes, the north star S-02 slice is complete and ready for commit.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in as a whitelisted member → visit `/` → see active challenges
2. Click "Submit Photo" on "First Light" → form expands inline
3. Leave both fields empty → confirm "Publish" is disabled
4. Paste a valid image URL → confirm photo preview renders
5. Type 49 characters in reflection → "Publish" still disabled; counter shows "49 / 50 characters" (gray)
6. Type one more character → "Publish" becomes enabled; counter turns green
7. Click Publish → observe "Publishing…" label; form collapses; submission appears in the card list within ~1 second
8. Open two browser tabs → submit from one → observe it appearing in the other (real-time test)
9. Verify mobile (375px): form is readable, inputs are full-width
10. Verify dark mode: form elements use dark backgrounds and light text
11. Server-side gate test: open browser DevTools console and attempt `await addDoc(collection(db, "submissions"), { challengeId: "<id>", photoUrl: "x", reflection: "short", authorUid: auth.currentUser.uid, authorEmail: auth.currentUser.email, createdAt: serverTimestamp(), parent_submission_id: null })` → expect `FirebaseError: Missing or insufficient permissions`

### Edge Cases

- Photo URL is a broken link → `<img>` shows browser broken-image icon; submission still writes and appears in feed (acceptable per MVP scope)
- User types exactly 50 characters → Publish becomes enabled; Firestore accepts the write
- User submits then quickly opens the form again → second form is a fresh empty state
- Challenge has zero submissions before submit → "No submissions yet — be the first!" disappears after first successful submission

## Performance Considerations

`addDoc` is a single Firestore write; at 5–15 members and low submission frequency, no batching or rate limiting is needed. The inline form state lives in `ChallengeCard` — each card instance is independent, so opening a form on one card has no re-render impact on others.

## Migration Notes

No data migration. The `submissions` collection is already live (created in F-03). All existing submission documents (if any, added via Firebase Console during testing) are unaffected.

## References

- PRD: `context/foundation/prd.md` — FR-006, FR-007, FR-008, US-01, Business Logic section
- Roadmap S-02: `context/foundation/roadmap.md`
- Data model + security rules: `context/archive/2026-06-15-firestore-schema-and-rules/plan.md`
- Feed component (prerequisite): `context/archive/2026-06-15-challenge-submission-feed/plan.md`
- Form pattern to follow: `app/routes/challenges.new.tsx`
- Feed component to modify: `app/routes/challenges.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Core Submission Form

#### Automated

- [x] 1.1 `npm run typecheck` exits 0 — 2a19925
- [x] 1.2 `npm run build` exits 0 — 2a19925

#### Manual

- [x] 1.3 "Submit Photo" button on card header toggles inline form open/closed
- [x] 1.4 "Publish" disabled with empty URL or <50-char reflection
- [x] 1.5 Pasting a valid image URL shows photo preview below input
- [x] 1.6 "Publish" enabled once URL is non-empty AND reflection ≥ 50 chars
- [x] 1.7 Submitting writes to Firestore and new submission appears in feed without page refresh
- [x] 1.8 "Cancel" collapses form without submitting

### Phase 2: Polish + Error States

#### Automated

- [x] 2.1 `npm run typecheck` exits 0
- [x] 2.2 `npm run build` exits 0

#### Manual

- [x] 2.3 Character counter turns green at exactly 50 chars
- [x] 2.4 "Publishing…" label shown during write; button un-clickable
- [x] 2.5 Dark mode styles correct on all form inputs and buttons
- [x] 2.6 Form readable and usable at 375px mobile width
- [x] 2.7 Submit error message shown on Firestore write failure
- [x] 2.8 Server-side gate test: direct `addDoc` with <50-char reflection throws permission denied
