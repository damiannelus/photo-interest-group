---
date: 2026-06-15T00:00:00+00:00
researcher: Claude Code
git_commit: 622ddd20fdf8167b2fd9007beea4b72273ac2d17
branch: feature/s05-challenge-creation
repository: photo-interest-group
topic: "What does challenge creation need: form flow, validation, DB write, auth guards?"
tags: [research, codebase, challenge-creation, firestore, react-router, auth]
status: complete
last_updated: 2026-06-15
last_updated_by: Claude Code
---

# Research: What does challenge creation need — form flow, validation, DB write, auth guards?

**Date**: 2026-06-15  
**Researcher**: Claude Code  
**Git Commit**: 622ddd20fdf8167b2fd9007beea4b72273ac2d17  
**Branch**: feature/s05-challenge-creation  
**Repository**: photo-interest-group

## Research Question

What does challenge creation need: form flow, validation, DB write, auth guards?

## Summary

S-05 requires a single new route (`/challenges/new`) with a form component, a Firestore `addDoc` write, and a navigate-back-to-feed on success. Auth guards are already provided by the existing `_protected` layout — no new guard code is needed. The only non-trivial infrastructure task is adding the `challenges` composite index to `firestore.indexes.json` and deploying it (index debt left by S-01), then restoring the `where("status", "==", "active")` filter in `app/routes/challenges.tsx`. UI work is a simple form with controlled inputs, a submit handler, and a brief "submitting" disabled state.

## Detailed Findings

### 1. Auth Guards — Already Handled

- `app/routes/_protected.tsx` (line 1–14): guards every child route with `useAuth()`. If `loading`, shows spinner; if no `user`, redirects to `/login`; if email not in `allowedEmails`, shows `RejectionScreen`.
- The new `challenges/new` route only needs to be nested inside the `_protected` layout in `app/routes.ts` — which it will be by adding `route("challenges/new", "routes/challenges.new.tsx")` inside the `layout("routes/_protected.tsx", [...])` block.
- Inside the component, `useAuth()` is safe to call and always returns a non-null `user` (because `_protected` already blocked unauthenticated access). `user.uid` is available for the `createdBy` field.

### 2. Form Flow

- Simple controlled-form pattern (no library needed): two fields — `title` (required, non-empty) and `description` (optional, may be blank).
- Client-side validation: `title.trim().length > 0` before enabling submit. Disabling the submit button while `title` is empty is the minimal UX guard.
- Submission state: a `submitting: boolean` flag disables the form and submit button while the Firestore write is in-flight.
- Error state: a string `error: string | null` surfaced above the submit button on Firestore write failure.
- On success: `useNavigate()` (from `react-router`) navigates to `/` (the feed).
- The login route (`app/routes/login.tsx`, line 19) shows the `useNavigate()` + `navigate("/")` pattern already in use in this codebase.

### 3. Firestore Write

- Import `addDoc`, `collection`, `serverTimestamp` from `"firebase/firestore"`.
- Import `db` from `"~/firebase"`.
- Document to write:
  ```ts
  await addDoc(collection(db, "challenges"), {
    title: title.trim(),
    description: description.trim(), // omit or empty string is fine; type allows optional
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    status: "active",
  });
  ```
- Security rule for create (`firestore.rules`, line 13): `allow create: if isWhitelisted()` — no ownership check on the `createdBy` field at write time. Any whitelisted member may create a challenge. The update rule (line 14–17) checks `request.auth.uid == resource.data.createdBy` and immutability of `createdBy`.
- `Challenge` interface (`app/types/challenge.ts`): `{ id, title, description?, createdBy, createdAt: Timestamp, status: "active"|"closed" }`. The `description` field is optional in the type (marked `?`), so omitting it or passing an empty string on the Firestore write both work. Sending an empty string is the simpler path (avoids a conditional).

### 4. Composite Index Debt (Critical Path)

- `app/routes/challenges.tsx` (line 131–134): the current challenges query uses only `orderBy("createdAt", "desc")` — the `where("status", "==", "active")` filter was intentionally removed by S-01's impl-review because the composite index was never deployed.
- `context/changes/challenge-submission-feed/plan.md` (lines 307–313): S-01 explicitly delegated this to S-05: "S-05 must add this composite index to `firestore.indexes.json` when it deploys Firestore changes, then re-add `where("status", "==", "active")` to the challenges query."
- `firestore.indexes.json` currently has ONE index (submissions: challengeId ASC + createdAt DESC). S-05 must add a second:
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
- Deploy: `firebase deploy --only firestore:indexes`. Wait for "Enabled" status in Firebase Console → Firestore → Indexes before restoring the filter.
- After index is Enabled: re-add `where("status", "==", "active")` to the query at `app/routes/challenges.tsx` line 132. The `where` import is already present (line 6) — only the query call changes.

### 5. Route Registration

- `app/routes.ts` (current): protected layout wraps only the index route and has `route("login", ...)` outside. The `challenges/new` route goes inside the protected layout:
  ```ts
  layout("routes/_protected.tsx", [
    index("routes/challenges.tsx"),
    route("challenges/new", "routes/challenges.new.tsx"),
  ])
  ```
- Route file naming convention observed: flat files in `app/routes/` using dot notation for segments (e.g., `login.tsx`, `challenges.tsx`). The new file should follow the same convention: `app/routes/challenges.new.tsx`.

### 6. Entry Point from Feed

- `app/routes/challenges.tsx` has TWO `{/* TODO S-05: CreateChallengeButton goes here */}` placeholders:
  - Line 162: inside the page header `div` (always visible)
  - Line 177: inside the empty-state `div` (only when no challenges exist)
- Both should be replaced with a `<Link to="/challenges/new">` from `react-router`. A styled button-link (Tailwind classes) is preferred over a bare anchor so it matches the feed's visual language.

### 7. UI Styling Conventions

- Feed uses Tailwind v4 utility classes throughout (`challenges.tsx`).
- No component library — utility classes directly.
- Dark mode support via `dark:` variants already used in the feed.
- No existing shared form component — S-05 will implement inline in the route component.
- Page wrapper pattern from feed: `max-w-2xl mx-auto py-8 px-4`.

## Code References

- `app/routes/_protected.tsx:1-14` — auth + whitelist guard layout; all nested routes inherit this automatically
- `app/context/auth.tsx:27-31` — `useAuth()` hook returning `{ user, loading }`
- `app/firebase.ts:21-23` — exports `app`, `auth`, `db`
- `app/types/challenge.ts:1-10` — `Challenge` interface; `description` is optional (`?`)
- `app/routes/challenges.tsx:130-134` — challenges query (missing status filter)
- `app/routes/challenges.tsx:161-163` — first TODO S-05 placeholder (header)
- `app/routes/challenges.tsx:176-178` — second TODO S-05 placeholder (empty state)
- `app/routes/challenges.tsx:6` — `where` import already present
- `app/routes/login.tsx:19` — `useNavigate()` + `navigate("/")` pattern in use
- `firestore.rules:13` — `allow create: if isWhitelisted()` for challenges
- `firestore.indexes.json:1-13` — current single submissions index; needs challenges index added
- `app/routes.ts:3-6` — current route config; `challenges/new` goes inside the layout block
- `context/changes/challenge-submission-feed/plan.md:307-313` — S-01 impl-review; composite index debt explicitly delegated to S-05

## Architecture Insights

**No new auth layer needed**: The `_protected` layout is the single gate for all whitelisted-only routes. Nesting inside it is the entire auth story for S-05.

**Form is a pure client component**: No loaders, actions, or server calls — this is a static SPA (`ssr: false`). The Firestore write happens directly in an event handler via the Firebase JS SDK, not via a React Router action. This matches the pattern already used in `challenges.tsx` (Firestore reads via `onSnapshot` directly in `useEffect`).

**Feed updates automatically**: After `addDoc` succeeds and `navigate("/")` fires, the existing `onSnapshot` in `challenges.tsx` will receive the new document and append it to the list. No manual refetch needed.

**`description` handling**: The type marks it optional (`description?: string`). Writing an empty string to Firestore is fine — the feed already guards it with `{challenge.description && ...}`. Consistently writing it (even as `""`) avoids a `fieldPath: undefined` write. The plan should choose one approach (empty string preferred for simplicity).

**Index timing is the only blocker**: Everything else is pure client-side React + Firestore. The composite index for `(status ASC, createdAt DESC)` on `challenges` must reach "Enabled" status before the `where("status", "==", "active")` filter can be restored. This is a manual step with a variable wait time (~1–5 minutes for a small collection).

## Historical Context (from prior changes)

- `context/changes/challenge-submission-feed/plan.md:307-313` — S-01 impl-review explicitly delegated the challenges composite index and `where("status", "==", "active")` restoration to S-05. This is a known, intentional handoff — not an oversight.
- `context/changes/challenge-submission-feed/plan.md:33-34` — S-01 confirmed the pattern: `db` from `~/firebase`, modular v12 Firestore API (`collection`, `query`, `where`, `orderBy`, `onSnapshot`). Same imports apply to the `addDoc` write in S-05.
- `context/archive/2026-06-15-auth-whitelist-gate/` — F-02 established `_protected.tsx` and the `allowedEmails` env-var pattern. S-05 inherits both without modification.
- `context/archive/2026-06-15-firestore-schema-and-rules/` — F-03 established the Firestore collections and security rules. The `allow create: if isWhitelisted()` rule for `/challenges/{challengeId}` is already live.

## Open Questions

1. **`description` on empty submit**: Should the Firestore write omit the `description` field when the user leaves it blank, or always write it (as `""`)?  
   Recommendation: always write it as `""` — simpler code, matches the `Challenge` interface intent, and the feed already handles it with `{challenge.description && ...}`.

2. **Form UX on submission**: Should the form clear on success or navigate away?  
   The user prompt specifies `navigate("/")` on success — navigate away is the contract.

3. **Index wait time**: The composite index for `challenges` may take 1–5 minutes to reach "Enabled". The implementation plan should pause at the deploy step and instruct the implementer to verify "Enabled" before restoring the filter.

4. **"Create Challenge" button label**: The feed placeholders are labelled "CreateChallengeButton". Suggested copy: "+ New Challenge" (concise, action-oriented). The implementer should use this or similar.
