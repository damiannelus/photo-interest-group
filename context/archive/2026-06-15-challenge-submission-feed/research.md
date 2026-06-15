---
date: 2026-06-15T00:00:00+00:00
researcher: Claude Code
git_commit: 8e51f90
branch: feature/s01-challenge-submission-feed
repository: photo-interest-group
topic: "What are the current challenge and submission data models, API routes, and auth patterns?"
tags: [research, codebase, firestore, challenges, submissions, auth, react-router, firebase]
status: complete
last_updated: 2026-06-15
last_updated_by: Claude Code
---

# Research: Challenge and Submission Data Models, API Routes, and Auth Patterns

**Date**: 2026-06-15T00:00:00+00:00
**Researcher**: Claude Code
**Git Commit**: 8e51f90
**Branch**: feature/s01-challenge-submission-feed
**Repository**: photo-interest-group

## Research Question

What are the current challenge and submission data models, API routes, and auth patterns?

## Summary

The app is a static SPA (React 19 + React Router 7.16, `ssr: false`) with Firebase Auth (Google Sign-In) and Firestore as the data layer. All three foundations (F-01, F-02, F-03) are complete and confirmed working. There are **no existing API routes or loaders** — the app is fully client-side with direct Firestore SDK calls. Auth is enforced both in the UI (via a pathless `_protected` layout route) and server-side (via Firestore Security Rules). The Firestore data model is fully defined and deployed. S-01 needs to: add a `challenges.tsx` route, define `app/types/challenge.ts` and `app/types/submission.ts`, and wire real-time Firestore listeners for challenges and submissions.

## Detailed Findings

### Data Model (Firestore — live, deployed)

Confirmed from `firestore.rules` and `context/archive/2026-06-15-firestore-schema-and-rules/plan.md`:

**`/challenges/{challengeId}`**
- `title: string`
- `description: string`
- `createdBy: string` — Firebase Auth UID
- `createdAt: Timestamp`
- `status: "active" | "closed"`

**`/submissions/{submissionId}`**
- `challengeId: string` — ID of parent `/challenges` doc
- `photoUrl: string` — URL to hosted image (pasted string, not Storage)
- `reflection: string` — min 50 chars, **enforced in Firestore rules** (`request.resource.data.reflection.size() >= 50`)
- `authorUid: string` — Firebase Auth UID
- `authorEmail: string` — denormalized for display
- `createdAt: Timestamp`
- `parent_submission_id: string | null` — null for root submissions; parent doc ID for follow-ups

**`/submissions/{submissionId}/comments/{commentId}`** (subcollection, for S-04)
- `text: string`
- `authorUid: string`
- `authorEmail: string`
- `createdAt: Timestamp`

**`/members/{email}`** (document ID = email address, lowercase)
- `email: string`

One seed challenge ("First Light") already exists in Firestore per F-03 Phase 2.

### Security Rules (deployed at `firestore.rules`)

- `isWhitelisted()`: `request.auth != null && exists(/databases/.../members/$(request.auth.token.email))`
- `/challenges`: read by any whitelisted member; create by any whitelisted member; update/delete only by `createdBy` owner
- `/submissions`: read by any whitelisted member; create requires `authorUid == request.auth.uid` AND `reflection.size() >= 50`; update/delete only by `authorUid` owner
- `/members`: read only by the member themselves (`token.email == email`); write disabled from client (`allow write: if false`)

### Auth Pattern

**`app/firebase.ts`** — exports `app`, `auth`, `db` singletons (already present, no changes needed for S-01):
- `auth = getAuth(app)`
- `db = getFirestore(app)`
- Config validated from `VITE_FIREBASE_*` env vars at module load

**`app/context/auth.tsx`** — `AuthProvider` + `useAuth()` hook:
- Subscribes to `onAuthStateChanged(auth, ...)` in `useEffect`
- Exposes `{ user: User | null, loading: boolean }`
- `loading` starts `true`, flips to `false` after first auth event
- Throws if `useAuth()` called outside provider

**`app/root.tsx`** — wraps entire app in `<AuthProvider>`, so `useAuth()` is available in all routes.

**`app/lib/allowedEmails.ts`** — client-side whitelist from `VITE_ALLOWED_EMAILS` env var (comma-separated, lowercased). This is a UI gate only; real enforcement is in Firestore rules via `/members` collection.

**`app/routes/_protected.tsx`** — pathless layout route:
1. `loading` → renders `<div>Loading…</div>`
2. `!user` → `<Navigate to="/login" replace />`
3. `user.email` not in `allowedEmails` → `<RejectionScreen />`
4. Otherwise → `<Outlet />`

### Route Structure (current `app/routes.ts`)

```typescript
export default [
  layout("routes/_protected.tsx", [
    index("routes/home.tsx"),     // → "/"
  ]),
  route("login", "routes/login.tsx"),  // → "/login"
] satisfies RouteConfig;
```

**S-01 must add `challenges.tsx` under the `_protected` layout.** Two options:
1. Replace `home.tsx` as the index route at `/` (rename home → challenges)
2. Add at a named path `/challenges` and keep or redirect home

Per the task instructions, S-01 should use route path `/` (replacing home.tsx) or `/challenges`. The existing `home.tsx` renders the boilerplate `<Welcome />` component and has no meaningful content — safe to replace or supplement.

### No Existing API Routes or Loaders

- `react-router.config.ts` has `ssr: false` — no server-side loaders or actions possible
- All data access will be direct Firestore SDK calls from client components
- No React Router loaders/actions pattern for data fetching
- Pattern: `useEffect` + `onSnapshot` (real-time) or `getDocs`/`getDoc` (one-shot) from `firebase/firestore`

### Firebase SDK Version

- `firebase: ^12.14.0` — this is Firebase JS SDK v12. The modular API (`import { collection, query, where, orderBy, getDocs, onSnapshot } from "firebase/firestore"`) is correct. The `compat` API is NOT used anywhere in the codebase.

### Build System

- `npm run typecheck` = `react-router typegen && tsc` (generates `.react-router/types/**/*` type stubs first)
- `npm run build` = `react-router build` → outputs to `build/client/`
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Path alias `~/*` → `./app/*` (used throughout existing code)

### Styling Conventions

- Minimal inline styles on existing components (login, rejection screen — `style={{...}}`)
- `app/app.css` imports Tailwind v4 (`@import "tailwindcss"`) with Inter font and dark mode via `dark:bg-gray-950`
- No existing UI component library — Tailwind utility classes are the approach for S-01

## Code References

- `app/firebase.ts` — Firebase singletons (`app`, `auth`, `db`)
- `app/context/auth.tsx` — `AuthProvider` and `useAuth()` hook
- `app/routes/_protected.tsx` — auth + whitelist guard layout (lines 1–14)
- `app/routes.ts` — current route config (6 lines; S-01 must modify)
- `app/routes/home.tsx` — current index route (13 lines; boilerplate only, safe to replace)
- `app/lib/allowedEmails.ts` — UI whitelist from env var
- `firestore.rules` — deployed security rules (all collections)
- `context/archive/2026-06-15-firestore-schema-and-rules/plan.md` — full data model reference and rules rationale
- `context/archive/2026-06-15-auth-whitelist-gate/plan.md` — auth implementation details

## Architecture Insights

1. **Static SPA, client-side Firestore only.** No server middleware, no loaders/actions. All data fetching is direct Firestore SDK in client components. This means Firestore Security Rules are the sole enforcement layer — they must remain deployed.

2. **`useAuth()` is the entry point for user identity.** `user.uid` and `user.email` are always available inside `_protected` layout children (the guard ensures `user` is non-null and whitelisted before `<Outlet />`).

3. **Firestore `db` is already exported.** S-01 imports `db` from `~/firebase` directly — no setup needed.

4. **Real-time listeners vs one-shot reads.** The feed should use `onSnapshot` for live updates (submissions appear without refresh — required by S-02's north star criteria). `onSnapshot` requires cleanup in `useEffect` return.

5. **Query patterns for S-01:**
   - Challenges: `collection(db, "challenges")` + `where("status", "==", "active")` + `orderBy("createdAt", "desc")`
   - Submissions per challenge: `collection(db, "submissions")` + `where("challengeId", "==", challengeId)` + `orderBy("createdAt", "desc")`
   - These queries will require a composite Firestore index (`challengeId` + `createdAt`). F-03 plan explicitly deferred composite indexes to "when S-01 query patterns are known" — S-01 must create this index.

6. **No `app/types/` directory exists yet.** S-01 is the first slice to define TypeScript types for Firestore documents. The task instructions require `app/types/challenge.ts` (for S-05 to import). A parallel `app/types/submission.ts` should also be created.

7. **Tailwind v4 vs inline styles.** Existing components use inline styles; new components for S-01 should use Tailwind utility classes for consistency with the design system direction.

8. **`home.tsx` is boilerplate.** It renders `<Welcome />` (the React Router scaffold default). S-01 can either replace it entirely (making `challenges.tsx` the new index route) or keep it and add `/challenges` as a named path. Per task instructions, replacing home.tsx as the index is the cleaner approach.

## Historical Context (from prior changes)

- `context/archive/2026-06-15-firestore-schema-and-rules/plan.md` — Data model rationale: email-as-doc-ID for members, comments as subcollection, `parent_submission_id` as nullable string, 50-char gate in rules (not in app code). Explicitly deferred composite Firestore indexes to S-01.
- `context/archive/2026-06-15-auth-whitelist-gate/plan.md` — `signInWithPopup` pattern, `loading` flag importance, `VITE_ALLOWED_EMAILS` as UI gate only. F-02 + F-03 ran in parallel and both added to `firebase.ts` — the current `firebase.ts` already has `app`, `auth`, and `db` all exported.
- `context/archive/2026-06-14-firebase-deploy-scaffold/` — F-01 set `ssr: false`, established Firebase Hosting static deploy. No SSR, no server functions.

## Open Questions

1. **Composite Firestore index for `submissions` query** — `where("challengeId", "==", x) + orderBy("createdAt", "desc")` requires a composite index. S-01 must create this index in Firebase Console (or via `firestore.indexes.json`). The first time the query runs without the index, Firestore returns an error with a direct link to create it.

2. **Pagination** — The roadmap and PRD don't specify pagination for the feed. For a 5–15 member group, loading all challenges and submissions in memory is fine for MVP. S-01 can use simple `getDocs`/`onSnapshot` without pagination.

3. **Route path choice** — Replace `/` (home.tsx) with challenges feed, or add `/challenges` and redirect from `/`? Per task instructions, either is acceptable; replacing home.tsx as index is cleaner since home.tsx has no real content.

4. **Loading states** — Each challenge card may load its submissions in a second query. A skeleton/spinner per challenge or a single top-level load state? Either is acceptable for MVP — the plan should decide.

5. **S-05 coordination file** — `app/types/challenge.ts` must be created by S-01 (per task instructions). S-05 will import `Challenge` from there without touching it.
