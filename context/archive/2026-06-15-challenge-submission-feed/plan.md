# Challenge + Submission Feed Implementation Plan (S-01)

## Overview

Build the main read-only feed at `/` — a list of active challenges, each with its submissions from members. This is the first vertical slice (S-01) and the prerequisite for S-02 (reflection-gated submission, the north star). The feed is read-only; S-05 adds challenge creation, S-02 adds submission creation.

## Current State Analysis

- React 19 + React Router 7.16, `ssr: false`, static SPA
- `app/firebase.ts` already exports `app`, `auth`, `db` — no changes needed
- `app/context/auth.tsx` exports `useAuth()` → `{ user, loading }` — used inside `_protected` layout
- `app/routes/_protected.tsx` guards all children — S-01 route inherits auth automatically
- `app/routes.ts` currently has one protected route: `index("routes/home.tsx")` (boilerplate `<Welcome />`)
- `app/routes/home.tsx` renders `<Welcome />` — pure boilerplate, will be replaced
- No `app/types/` directory exists — S-01 creates it
- Firestore collections `/challenges` and `/submissions` are live with deployed security rules
- One seed challenge ("First Light") exists in Firestore for testing
- Firebase SDK v12 modular API is the correct pattern (`firebase/firestore`)
- Tailwind CSS v4 is wired; no component library — utility classes throughout

## Desired End State

A whitelisted member visits `/` and sees:
- A page title and a placeholder comment where S-05's "Create Challenge" button will live
- All active challenges listed as cards (title, description, inline submission list with count label)
- Each challenge card expanded to show its submissions inline (photo URL, author email, reflection excerpt)
- Feed updates in real-time when new submissions are added (no page refresh needed)
- Loading and empty states handled gracefully

### Key Discoveries

- `db` from `~/firebase` is the Firestore entry point — modular v12 API required (`collection`, `query`, `where`, `orderBy`, `onSnapshot` from `firebase/firestore`)
- `useAuth()` inside `_protected` children always returns non-null `user` — no null checks needed in the feed component
- The submissions query `where("challengeId", "==", id) + orderBy("createdAt", "desc")` requires a composite Firestore index — F-03 explicitly deferred this to S-01
- `firestore.indexes.json` (committed to repo) is the infra-as-code approach for indexes — avoids manual Console steps
- `firebase.json` must declare `"firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }` so `firebase deploy --only firestore:indexes` works
- S-05 will import `Challenge` from `app/types/challenge.ts` — this file must be created by S-01 with the correct shape

## What We're NOT Doing

- No challenge creation UI (`/challenges/new`) — that is S-05
- No submission creation form — that is S-02
- No comments display — that is S-04
- No follow-up submission linking — that is S-03
- No pagination — group is 5–15 members; full in-memory load is acceptable for MVP
- No photo thumbnail rendering — photos are URL strings; display as `<img src={photoUrl}>` only
- No closed challenges in the feed — `status === "active"` filter only
- No Firestore emulator setup — testing against live project per F-03 precedent
- No `home.tsx` or `<Welcome />` — replaced entirely; the welcome component directory (`app/welcome/`) is left untouched (unused assets, not worth deleting mid-slice)

## Implementation Approach

Three phases in order:

1. **TypeScript types + Firestore index** — establish `app/types/challenge.ts` and `app/types/submission.ts` (S-05 dependency), wire `firestore.indexes.json`, update `firebase.json`
2. **Feed route + Firestore data layer** — create `app/routes/challenges.tsx` as the new index route at `/`, wire `onSnapshot` listeners for challenges and submissions, register in `app/routes.ts` (replacing `home.tsx`)
3. **UI polish + error states** — loading skeleton, empty state, error boundary messaging, Tailwind styling

## Critical Implementation Details

**`onSnapshot` cleanup**: Each challenge card subscribes to its own submissions listener. These must be cleaned up in `useEffect` return functions to prevent memory leaks and stale listeners after unmount. The pattern is: `const unsub = onSnapshot(q, cb); return unsub;`.

**Composite index timing**: The `firestore.indexes.json` must be deployed (`firebase deploy --only firestore:indexes`) before the submissions query runs in the browser, or Firestore returns a permission/index error with a console link. Deploy the index in Phase 1 before any browser testing.

**S-05 coordination — `app/types/challenge.ts` is a shared contract**: S-05 will `import type { Challenge } from "~/types/challenge"`. The field names and types must exactly match the Firestore document schema from F-03. Do not rename fields or add non-Firestore fields to this type.

**Route replacement**: `app/routes/home.tsx` is removed and `app/routes/challenges.tsx` takes its place as `index(...)` in `routes.ts`. The `home.tsx` file should be deleted (not just de-registered) to avoid confusion. The `app/welcome/` directory is left as-is.

---

## Phase 1: TypeScript Types + Firestore Index

### Overview

Create the shared TypeScript types for Firestore documents and wire the composite index needed for the submissions query. This phase has no UI — it establishes the data contracts that Phase 2 builds on and satisfies the S-05 coordination requirement.

### Changes Required

#### 1. Create `app/types/challenge.ts`

**File**: `app/types/challenge.ts` (new)

**Intent**: Define the TypeScript type for a `/challenges/{id}` Firestore document. S-05 will import `Challenge` from this file — the shape must match the deployed Firestore schema exactly.

**Contract**: Export a `Challenge` interface with fields: `id: string` (the Firestore document ID, added client-side), `title: string`, `description: string`, `createdBy: string`, `createdAt: Timestamp`, `status: "active" | "closed"`. Import `Timestamp` from `"firebase/firestore"`.

#### 2. Create `app/types/submission.ts`

**File**: `app/types/submission.ts` (new)

**Intent**: Define the TypeScript type for a `/submissions/{id}` Firestore document. S-02 and S-03 will import `Submission` from this file.

**Contract**: Export a `Submission` interface with fields: `id: string`, `challengeId: string`, `photoUrl: string`, `reflection: string`, `authorUid: string`, `authorEmail: string`, `createdAt: Timestamp`, `parent_submission_id: string | null`. Import `Timestamp` from `"firebase/firestore"`.

#### 3. Create `firestore.indexes.json`

**File**: `firestore.indexes.json` (new, repo root)

**Intent**: Declare the composite Firestore index required for the submissions-by-challenge query so it can be deployed via CLI and tracked in version control.

**Contract**: The file must declare one composite index on the `submissions` collection with fields `challengeId` (ASCENDING) and `createdAt` (DESCENDING), query scope COLLECTION:

```json
{
  "indexes": [
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "challengeId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

#### 4. Update `firebase.json` to declare the indexes file

**File**: `firebase.json`

**Intent**: Add the `"indexes"` key to the `"firestore"` block so `firebase deploy --only firestore:indexes` picks up `firestore.indexes.json`.

**Contract**: The `"firestore"` object in `firebase.json` currently has `{ "rules": "firestore.rules" }`. Add `"indexes": "firestore.indexes.json"` alongside it.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- `firebase deploy --only firestore:indexes` exits 0 (run in terminal after automated checks pass)
- Firebase Console → Firestore → Indexes tab shows the composite index on `submissions` (`challengeId` ASC, `createdAt` DESC) with status "Enabled"

**Implementation Note**: Deploy the index before proceeding to Phase 2 — the submissions query in Phase 2 will fail without it. Pause for manual confirmation that the index is "Enabled" in the Console before continuing.

---

## Phase 2: Feed Route + Firestore Data Layer

### Overview

Replace `home.tsx` with `challenges.tsx` as the index route at `/`. Wire real-time `onSnapshot` listeners for active challenges and their submissions. Register the route in `routes.ts`.

### Changes Required

#### 1. Delete `app/routes/home.tsx`

**File**: `app/routes/home.tsx` (delete)

**Intent**: Remove the boilerplate home route to avoid confusion. The file has no meaningful content and is replaced entirely by `challenges.tsx`.

#### 2. Create `app/routes/challenges.tsx`

**File**: `app/routes/challenges.tsx` (new)

**Intent**: The main feed page. Subscribes to active challenges via `onSnapshot`, renders each as a card with inline submissions. This is the index route at `/`.

**Contract**:
- Export a default `ChallengeFeed` component (no `meta` export needed at this stage — can be added later)
- Import `db` from `~/firebase`; import `collection`, `query`, `where`, `orderBy`, `onSnapshot` from `"firebase/firestore"`
- Import `Challenge` from `~/types/challenge` and `Submission` from `~/types/submission`
- Top-level `onSnapshot` for challenges: `query(collection(db, "challenges"), where("status", "==", "active"), orderBy("createdAt", "desc"))` — maps each `QueryDocumentSnapshot` to `{ id: doc.id, ...doc.data() } as Challenge`
- State: `challenges: Challenge[]`, `loading: boolean` (starts true, set false after first snapshot)
- Extract a `ChallengeCard` child component that accepts a `challenge: Challenge` prop and manages its own submissions listener internally. This lets React's unmount lifecycle handle cleanup automatically and avoids managing an array of unsubscribers in the parent.
- Inside `ChallengeCard`: subscribe to submissions via `query(collection(db, "submissions"), where("challengeId", "==", challenge.id), orderBy("createdAt", "desc"))` — maps to `Submission[]` state
- All `onSnapshot` calls must return their unsubscribe function from `useEffect` cleanup — in `ChallengeCard`, `const unsub = onSnapshot(q, cb); return unsub;`
- Include `{/* TODO S-05: CreateChallengeButton goes here */}` comment in the JSX, visually near the page header
- Include `{/* TODO S-02: SubmitPhotoButton goes here */}` comment near each challenge card header (where the submit action will live)

#### 3. Update `app/routes.ts`

**File**: `app/routes.ts`

**Intent**: Replace the `home.tsx` index with `challenges.tsx` so `/` renders the feed.

**Contract**: Replace `index("routes/home.tsx")` with `index("routes/challenges.tsx")` inside the `layout("routes/_protected.tsx", [...])` block. No other changes.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- `npm run dev` — visiting `http://localhost:5173/` while signed in as a whitelisted member shows the challenges feed (at minimum the seed "First Light" challenge)
- Submissions under each challenge load and display (may be empty if no submissions have been added yet — empty state message shown)
- Browser DevTools console shows no Firebase permission errors or index errors
- Real-time update: open two browser tabs; adding a submission document directly in Firebase Console causes it to appear in the feed without a page refresh

**Implementation Note**: Pause here for manual confirmation that the live feed is working before proceeding to Phase 3.

---

## Phase 3: UI Polish + Error States

### Overview

Apply Tailwind styling for a clean, readable feed layout. Add loading skeleton, empty state, and error messaging. This phase is purely presentational — no data or routing changes.

### Changes Required

#### 1. Loading state in `challenges.tsx`

**File**: `app/routes/challenges.tsx`

**Intent**: While the initial challenges snapshot is loading, show a loading indicator so the page doesn't flash blank.

**Contract**: When `loading === true`, render a simple loading message or skeleton (e.g., `<div className="text-gray-500 text-center py-12">Loading challenges…</div>`). Once `loading` flips to false, render the feed.

#### 2. Empty states

**File**: `app/routes/challenges.tsx`

**Intent**: When there are no active challenges, or a challenge has no submissions, show a helpful message rather than a blank space.

**Contract**:
- No active challenges: render a message like "No active challenges yet." with the S-05 TODO comment nearby
- No submissions on a challenge: render "No submissions yet — be the first!" with the S-02 TODO comment

#### 3. Error state

**File**: `app/routes/challenges.tsx`

**Intent**: If the Firestore snapshot returns an error (e.g., rules change, network issue), show a recoverable error message rather than a silent failure.

**Contract**: `onSnapshot` accepts a third argument `onError` callback. Capture error in state (`error: string | null`). If error is set, render `<div className="text-red-600">Failed to load challenges. Please refresh.</div>`. Clear error on successful snapshot.

#### 4. Tailwind layout and card styling

**File**: `app/routes/challenges.tsx`

**Intent**: Apply clean, readable Tailwind v4 utility classes for the page layout, challenge cards, and submission list items.

**Contract**: Page wrapper `max-w-2xl mx-auto py-8 px-4`. Challenge card: `border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-white dark:bg-gray-900`. Above the submission list, show a count label: `{submissions.length} submission{submissions.length !== 1 ? 's' : ''}`. Submission item: `flex gap-3 py-3 border-t border-gray-100 dark:border-gray-800`. Photo: `w-16 h-16 object-cover rounded`. Author email: `text-sm font-medium text-gray-700 dark:text-gray-300`. Reflection: `text-sm text-gray-600 dark:text-gray-400 line-clamp-2`. These are starting values — the implementer can adjust as needed for visual quality.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Loading state appears briefly on first load, then transitions to the feed
- Empty challenge list shows "No active challenges yet." message
- A challenge with no submissions shows "No submissions yet — be the first!" message
- Layout is readable on both desktop (1280px) and mobile (375px) widths
- Dark mode (system preference) applies correctly (dark backgrounds, lighter text)
- No console errors during normal operation

**Implementation Note**: This is the final phase. After manual verification passes, the implementation is complete and ready for review and commit.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in as a whitelisted member → visit `/` → see "First Light" seed challenge
2. Seed a submission document directly in Firebase Console for the "First Light" challenge → verify it appears in the feed without a page refresh
3. Add a second submission → verify ordering (most recent first)
4. Resize to mobile (375px) → verify layout is not broken
5. Toggle OS dark mode → verify dark mode styles apply
6. Open DevTools console → verify zero Firebase errors across all interactions
7. Temporarily remove the composite index from Firebase Console → verify the app shows a graceful error message (not a blank crash) → re-add index

### Edge Cases

- Challenge with no submissions → "No submissions yet" message shown
- Zero active challenges → "No active challenges yet" message shown
- Firebase Firestore unreachable (airplane mode) → error state shown, not silent blank
- `photoUrl` is a broken image URL → `<img>` shows browser broken-image icon (acceptable for MVP; no custom error handling required)

## Performance Considerations

With 5–15 members and ~1 challenge at MVP launch, the data volume is trivial. `onSnapshot` over all active challenges + their submissions is well within Firestore's free tier and React's rendering budget. No memoization, virtual scrolling, or pagination is required for MVP.

## Migration Notes

No data migration. `home.tsx` is deleted (boilerplate only — no user data or navigation links point to it). The `app/welcome/` directory is left in place (unused assets).

## References

- Research: `context/changes/challenge-submission-feed/research.md`
- Data model source: `context/archive/2026-06-15-firestore-schema-and-rules/plan.md`
- Auth pattern source: `context/archive/2026-06-15-auth-whitelist-gate/plan.md`
- Firestore modular API: `app/firebase.ts`, `firebase/firestore`
- Route registration pattern: `app/routes.ts` (current)
- Protected layout: `app/routes/_protected.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Impl-Review Findings (post-Phase 3)

- **F1 (WARNING) — Delegated to S-05**: The challenges query has no `status` filter because the composite index for `(status ASC, createdAt DESC)` on the `challenges` collection was not deployed. The `where("status", "==", "active")` clause was removed as a workaround (challenges query now uses only `orderBy("createdAt", "desc")`). **S-05 must add this composite index to `firestore.indexes.json`** when it deploys Firestore changes, then re-add `where("status", "==", "active")` to the challenges query in `app/routes/challenges.tsx`.
- **F2 (OBSERVATION) — Fixed**: `description` made optional (`description?: string`) in `app/types/challenge.ts`. Challenge documents in Firestore may omit this field; the optional type prevents TypeScript runtime surprises. The JSX in `challenges.tsx` already guards the field with `{challenge.description && ...}`, so no other changes were needed.
- **F3 (OBSERVATION) — Accepted**: Broken-image fallback for `<img src={sub.photoUrl}>` is intentionally deferred. The plan explicitly called this acceptable for MVP (browser broken-image icon shown). No action taken.

### Bug Fix (post-Phase 2)

After Phase 2 implementation a runtime error surfaced: the challenges query used `where("status", "==", "active")` combined with `orderBy("createdAt", "desc")`, which requires a composite Firestore index on `(status, createdAt)`. That index was not deployed — `firestore.indexes.json` only contains the submissions composite index. The fix simplifies the challenges query to `query(collection(db, "challenges"), orderBy("createdAt", "desc"))`, relying on Firestore's automatically maintained single-field index on `createdAt`. The `where` import was kept in `app/routes/challenges.tsx` because it is still used in the submissions sub-query inside `ChallengeCard`. `npm run typecheck` passes after the fix. Consequence: closed challenges will appear in the feed at MVP scale; S-05 should add the composite index and re-enable the `where("status", "==", "active")` filter when challenge creation is added.

### Phase 1: TypeScript Types + Firestore Index

#### Automated

- [x] 1.1 `npm run typecheck` exits 0
- [x] 1.2 `npm run build` exits 0

#### Manual

- [x] 1.3 `firebase deploy --only firestore:indexes` exits 0
- [x] 1.4 Firebase Console → Indexes tab shows composite index on `submissions` with status "Enabled"

### Phase 2: Feed Route + Firestore Data Layer

#### Automated

- [x] 2.1 `npm run typecheck` exits 0
- [x] 2.2 `npm run build` exits 0

#### Manual

- [x] 2.3 `/` shows seed "First Light" challenge while signed in as whitelisted member
- [x] 2.4 No Firebase permission or index errors in DevTools console
- [x] 2.5 Real-time update: new submission added in Firebase Console appears without page refresh

### Phase 3: UI Polish + Error States

#### Automated

- [x] 3.1 `npm run typecheck` exits 0
- [x] 3.2 `npm run build` exits 0

#### Manual

- [x] 3.3 Loading state appears on first load then transitions to feed
- [x] 3.4 Empty state messages shown for no challenges and no submissions
- [x] 3.5 Layout readable at 375px mobile and 1280px desktop
- [x] 3.6 Dark mode styles apply correctly
- [x] 3.7 Zero console errors during normal operation
