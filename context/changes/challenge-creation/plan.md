# Challenge Creation Implementation Plan (S-05)

## Overview

Add a `/challenges/new` route with a form that lets any whitelisted member create a new challenge (title + optional description). On success, writes to Firestore and navigates back to the feed at `/`. Also resolves the composite index debt left by S-01 — deploying the `(status, createdAt)` index on the `challenges` collection so the feed's `where("status", "==", "active")` filter can be restored.

## Current State Analysis

- React 19 + React Router 7, `ssr: false`, static SPA
- `app/firebase.ts` exports `db` — Firestore modular v12 API is the pattern
- `app/context/auth.tsx` exports `useAuth()` → `{ user, loading }`
- `app/routes/_protected.tsx` guards every nested route — no new auth code needed
- `app/routes/challenges.tsx` is the feed at `/`; it has two `{/* TODO S-05 */}` placeholders and a challenges query that currently lacks `where("status", "==", "active")` due to missing composite index
- `firestore.indexes.json` has one index (submissions); the `challenges` composite index was never deployed
- `app/types/challenge.ts` exports `Challenge` — `description` is optional (`description?: string`)
- `firestore.rules` line 13: `allow create: if isWhitelisted()` — no additional Firestore rule changes needed
- Firestore `addDoc` / `serverTimestamp` are the correct write primitives; `useNavigate()` from `react-router` is the navigation primitive (used in `login.tsx`)

## Desired End State

A whitelisted member:
1. Clicks "+ New Challenge" in the feed header (or in the empty-state message)
2. Is taken to `/challenges/new`
3. Fills in a title (required) and optionally a description
4. Submits — the document is written to Firestore as `{ title, description, createdBy: user.uid, createdAt: serverTimestamp(), status: "active" }`
5. Is navigated back to `/` where the new challenge appears immediately (via the existing `onSnapshot` listener)

The feed at `/` also shows only `active` challenges (the `where("status", "==", "active")` filter is restored after the composite index reaches "Enabled").

### Key Discoveries

- Auth guard is inherited from `_protected` layout — no guard code in the new route
- `useAuth().user` is always non-null inside `_protected` children — `user.uid` is safe to use directly
- `description` always written as empty string `""` when blank — avoids conditional and the feed already guards it with `{challenge.description && ...}`
- Feed real-time update is free — existing `onSnapshot` picks up the new document automatically
- Two TODO placeholders in `challenges.tsx` (lines 162 and 177) — both replaced with `<Link>` to `/challenges/new`
- `where` import already present in `challenges.tsx` line 6 — only the query call needs updating after the index is enabled

## What We're NOT Doing

- No challenge editing or deletion UI — out of scope for S-05
- No file/image upload for the challenge itself — challenge is title + description only
- No per-user challenge ownership UI — Firestore rules handle ownership for future update/delete
- No pagination or search — group is 5–15 members; full list is fine
- No Firestore emulator — testing against live project per project precedent
- No new Firestore security rules — existing `allow create: if isWhitelisted()` covers the write

## Implementation Approach

Three phases in dependency order:

1. **Composite index + feed entry point** — add the `challenges` index to `firestore.indexes.json`, deploy it, and replace the two TODO placeholders in `challenges.tsx` with real `<Link>` buttons. Contains the only manual pause (wait for index "Enabled" status before proceeding to phase 2 for the filter restoration).
2. **New challenge form route** — create `app/routes/challenges.new.tsx` with the controlled form, Firestore write, and navigate-on-success. Register in `app/routes.ts`.
3. **Restore status filter + verification** — re-add `where("status", "==", "active")` to the challenges query in `challenges.tsx` now that the index is enabled; verify the filter works end-to-end.

## Critical Implementation Details

**Index deploy is a hard gate between Phase 1 and Phase 3.** The `firebase deploy --only firestore:indexes` command in Phase 1 starts index build asynchronously. Phase 2 (form route) can proceed in parallel, but Phase 3 (restoring the `where` filter) must not start until the Firebase Console shows the `challenges` index status as "Enabled". Enabling typically takes 1–5 minutes for a small collection.

**`description` field**: always write `description: description.trim()` — pass the trimmed string even when it is `""`. The `Challenge` type marks it optional, but writing an empty string is consistent and avoids a Firestore `undefined` field write.

---

## Phase 1: Composite Index + Feed Entry Point

### Overview

Add the missing `challenges` composite index to `firestore.indexes.json`, deploy it, and replace both S-05 TODO placeholders in the feed with a styled `<Link to="/challenges/new">` button. The index deployment is asynchronous — after `firebase deploy` exits, wait for "Enabled" status in the Firebase Console before proceeding to Phase 3 (but Phase 2 can proceed immediately).

### Changes Required

#### 1. Update `firestore.indexes.json`

**File**: `firestore.indexes.json`

**Intent**: Add the composite index for `challenges` (`status` ASC, `createdAt` DESC) that the feed's `where("status", "==", "active") + orderBy("createdAt", "desc")` query requires. This is the index debt left by S-01.

**Contract**: Append a second object to the `"indexes"` array alongside the existing submissions index:
```json
{
  "collectionGroup": "challenges",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

#### 2. Tighten `firestore.rules` challenges create rule

**File**: `firestore.rules`

**Intent**: Add a `status == "active"` guard to the challenges create rule so a whitelisted member cannot write a challenge with an arbitrary `status` value client-side. This closes a data-integrity gap identified in plan review (F1).

**Contract**: Change the challenges `allow create` rule from:
```
allow create: if isWhitelisted();
```
to:
```
allow create: if isWhitelisted() && request.resource.data.status == "active";
```
Deploy the updated rule alongside the index: `firebase deploy --only firestore:indexes,firestore:rules`.

#### 3. Replace S-05 TODO placeholders in `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx`

**Intent**: Replace both `{/* TODO S-05: CreateChallengeButton goes here */}` comments with a real `<Link to="/challenges/new">` so members can navigate to the creation form from the feed.

**Contract**: Import `Link` from `"react-router"`. Replace the placeholder at line 162 (inside the page header flex row, right side) and the placeholder at line 177 (inside the empty-state block). Both become the same link styled as a button: label "+ New Challenge", Tailwind classes consistent with the feed's visual language (e.g., `bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium`). Dark mode variants optional but consistent with existing `dark:` usage in the file.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Required Actions (run after automated checks pass)

- Run `firebase deploy --only firestore:indexes,firestore:rules` — exits 0

#### Manual Verification

- Firebase Console → Firestore → Indexes tab shows the `challenges` composite index (`status` ASC, `createdAt` DESC) with status "Enabled"
- Feed at `/` shows "+ New Challenge" button in the header
- "+ New Challenge" in the empty-state block is visible when no challenges exist

**Implementation Note**: After `firebase deploy` exits, the index build runs asynchronously. Phase 2 can start immediately. Do NOT proceed to Phase 3 (restoring the `where` filter) until the Firebase Console confirms "Enabled" status for the `challenges` index.

---

## Phase 2: New Challenge Form Route

### Overview

Create the `app/routes/challenges.new.tsx` file with the challenge creation form — two controlled inputs (title required, description optional), a Firestore `addDoc` write on submit, and `navigate("/")` on success. Register the route in `app/routes.ts` inside the `_protected` layout.

### Changes Required

#### 1. Create `app/routes/challenges.new.tsx`

**File**: `app/routes/challenges.new.tsx` (new)

**Intent**: The challenge creation page. Renders a form with a title input and an optional description textarea, writes the new challenge to Firestore on submit, and navigates to `/` on success.

**Contract**:
- Export a default `NewChallengePage` component
- Import `addDoc`, `collection`, `serverTimestamp` from `"firebase/firestore"`; `db` from `"~/firebase"`; `useAuth` from `"~/context/auth"`; `useNavigate` from `"react-router"`
- State: `title: string` (starts `""`), `description: string` (starts `""`), `submitting: boolean` (starts `false`), `error: string | null` (starts `null`)
- Submit handler: disabled when `title.trim().length === 0` or `submitting === true`. Sets `submitting = true`, calls `addDoc` with `{ title: title.trim(), description: description.trim(), createdBy: user.uid, createdAt: serverTimestamp(), status: "active" }`, then `navigate("/")`. On Firestore error: sets `error` to a human-readable message and resets `submitting = false`.
- Layout: same `max-w-2xl mx-auto py-8 px-4` wrapper as the feed. Page title "New Challenge". Two fields: a text input for "Title" (required) and a textarea for "Description" (optional). A "Create Challenge" submit button disabled when title is empty or submitting. An optional "Cancel" link (`<Link to="/">Back to challenges</Link>`) for escape hatch. Error displayed in red above the submit button when `error` is set.
- Tailwind styling consistent with `challenges.tsx` patterns; dark mode `dark:` variants for inputs and labels

#### 2. Update `app/routes.ts`

**File**: `app/routes.ts`

**Intent**: Register the new `challenges/new` route inside the `_protected` layout so it inherits auth guarding automatically.

**Contract**: Add `route("challenges/new", "routes/challenges.new.tsx")` inside the `layout("routes/_protected.tsx", [...])` array, alongside the existing `index("routes/challenges.tsx")`. The `login` route outside the layout is unchanged.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Visiting `/challenges/new` while signed in shows the form with title input, description textarea, and "Create Challenge" submit button
- "Create Challenge" button is disabled when title is empty; enabled once any non-whitespace title is entered
- Submitting the form creates a new document in Firestore `challenges` collection with correct fields (`title`, `description`, `createdBy`, `createdAt`, `status: "active"`)
- After successful submission, user is navigated to `/` and the new challenge appears in the feed
- Unauthenticated access to `/challenges/new` redirects to `/login` (inherited from `_protected`)
- Form shows an error message if the Firestore write fails

**Implementation Note**: Verify the Firestore write by checking Firebase Console → Firestore → `challenges` collection for the newly created document. Confirm `createdBy` matches the signed-in user's UID.

---

## Phase 3: Restore Status Filter

### Overview

Now that the `challenges` composite index is "Enabled" (confirmed in Phase 1), re-add the `where("status", "==", "active")` filter to the challenges query in `challenges.tsx`. This closes the S-01 index debt and ensures the feed only shows active challenges.

**Prerequisite**: Firebase Console must show the `challenges` index status as "Enabled" before this phase runs.

### Changes Required

#### 1. Restore `where("status", "==", "active")` in `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx`

**Intent**: Re-add the status filter to the challenges `onSnapshot` query so only `active` challenges appear in the feed. The `where` import is already present; only the query call changes.

**Contract**: In the `useEffect` inside `ChallengeFeed`, update the `query(...)` call at line ~132 from:
```ts
query(collection(db, "challenges"), orderBy("createdAt", "desc"))
```
to:
```ts
query(collection(db, "challenges"), where("status", "==", "active"), orderBy("createdAt", "desc"))
```
No other changes to the file.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Feed at `/` loads without Firestore index errors in DevTools console
- Only `active` challenges appear (verify by checking a `closed` challenge document in Firebase Console — it should not appear in the feed)
- New challenge created via `/challenges/new` appears immediately in the feed after navigation

**Implementation Note**: If the index has not yet reached "Enabled" status when this phase runs, Firestore will return an error (visible in DevTools console). Wait and retry. Do not merge or commit Phase 3 until the filter is confirmed working.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in as whitelisted member → visit `/` → "+ New Challenge" button visible in header
2. Click "+ New Challenge" → form at `/challenges/new` appears with title and description fields
3. Leave title empty → "Create Challenge" button is disabled
4. Enter a title → button enables
5. Submit → navigated to `/`, new challenge appears at top of feed (most-recent-first ordering)
6. Verify Firebase Console → `challenges` collection shows the new document with correct `status: "active"`, `createdBy`, `createdAt`
7. Check DevTools console — no Firestore index or permission errors at any step
8. Set a challenge's `status` to `"closed"` directly in Firebase Console → verify it disappears from the feed (Phase 3 filter active)

### Edge Cases

- Title with only whitespace → `title.trim().length === 0` → button stays disabled, no write
- Firestore write failure (e.g., offline) → error message shown, form stays open
- Back-navigation from `/challenges/new` without submitting → feed unchanged
- Non-whitelisted user manually navigating to `/challenges/new` → redirected to `/login` by `_protected`

## Performance Considerations

`addDoc` is a single-document write; response time is network-bound (~100–300ms on good connection). No debouncing or optimistic UI needed for MVP at 5–15 members.

## Migration Notes

No data migration. Existing seed challenge documents in Firestore remain unchanged. The status filter restored in Phase 3 may hide any `closed` documents that were previously visible — this is intentional.

## References

- Research: `context/changes/challenge-creation/research.md`
- S-01 index debt source: `context/changes/challenge-submission-feed/plan.md:307-313`
- Feed entry point: `app/routes/challenges.tsx:161-163`, `app/routes/challenges.tsx:176-178`
- Auth guard: `app/routes/_protected.tsx`
- Navigate pattern: `app/routes/login.tsx:19`
- Challenge type: `app/types/challenge.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Composite Index + Feed Entry Point

#### Automated

- [x] 1.1 `npm run typecheck` exits 0
- [x] 1.2 `npm run build` exits 0

#### Required Actions

- [x] 1.3 `firebase deploy --only firestore:indexes,firestore:rules` exits 0

#### Manual

- [x] 1.4 Firebase Console → challenges index status "Enabled"
- [x] 1.5 Feed shows "+ New Challenge" button in header
- [x] 1.6 "+ New Challenge" visible in empty-state block

### Phase 2: New Challenge Form Route

#### Automated

- [x] 2.1 `npm run typecheck` exits 0
- [x] 2.2 `npm run build` exits 0

#### Manual

- [x] 2.3 `/challenges/new` shows form with title and description fields
- [x] 2.4 Submit button disabled when title empty; enabled with non-empty title
- [x] 2.5 Successful submit creates Firestore document with correct fields
- [x] 2.6 After submit, navigated to `/` with new challenge in feed
- [x] 2.7 Unauthenticated access to `/challenges/new` redirects to `/login`
- [x] 2.8 Firestore write error shows error message in form

### Phase 3: Restore Status Filter

#### Automated

- [x] 3.1 `npm run typecheck` exits 0
- [x] 3.2 `npm run build` exits 0

#### Manual

- [x] 3.3 Feed loads without Firestore index errors in DevTools console
- [x] 3.4 `closed` challenges do not appear in feed
- [x] 3.5 New challenges created via form appear immediately in feed
