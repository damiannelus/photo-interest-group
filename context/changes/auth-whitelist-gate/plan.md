# Auth + Whitelist Gate Implementation Plan

## Overview

Wire Google Sign-In (Firebase Auth) into the React Router v7 SPA, enforce a `VITE_ALLOWED_EMAILS` env-var whitelist in the UI, and guard all app routes behind a pathless layout route. After this change, unauthenticated visitors see a `/login` page; authenticated non-members see a rejection screen; whitelisted members reach the app.

## Current State Analysis

- `app/firebase.ts` exports only `app` — no `auth` or `db` singletons yet.
- `app/root.tsx` renders `<Outlet />` with no auth awareness.
- `app/routes.ts` has one route: `index("routes/home.tsx")`.
- No auth SDK imports anywhere in the codebase.
- `react-router.config.ts` has `ssr: false` and `v8_middleware: true` (future flag).
- Firebase project is live at `photo-interest-group.web.app`; `VITE_FIREBASE_*` env vars are populated.

## Desired End State

- Visiting any app URL while signed out redirects to `/login`.
- Clicking "Sign in with Google" triggers `signInWithPopup`; on success, the user's email is checked against `VITE_ALLOWED_EMAILS`.
- A whitelisted user is routed to the app (currently `home.tsx`).
- A non-whitelisted user sees a rejection screen with a "Sign Out" button.
- All protected routes are nested under a single `_protected` layout route — adding a new route to the app automatically inherits the auth guard.

### Key Discoveries

- `signInWithPopup` is correct for SPA; `signInWithRedirect` requires `getRedirectResult` on load and creates a boot-time async gap.
- Firebase Auth user is `null` synchronously on load until `onAuthStateChanged` fires. A `loading` flag is essential to prevent a flash-redirect before auth state is known.
- `VITE_ALLOWED_EMAILS` is a UI gate only — it lives in the JS bundle. The server-side enforcement layer is Firestore Security Rules (F-03). Both must be in place before the app is considered secure.
- `signInWithPopup` must be called from a direct user gesture (button click) — never from `useEffect` or `onAuthStateChanged`.
- F-03 (firestore-schema-and-rules) is planned in parallel. To avoid a `firebase.ts` merge conflict, this plan adds both `auth` AND `db` exports in Phase 1. F-03 imports `db` from here without touching `firebase.ts`.

## What We're NOT Doing

- No Firestore-backed whitelist in the UI (that's F-03's `members` collection, for rules only).
- No session persistence customization — Firebase default (IndexedDB) is used.
- No email/password auth — Google Sign-In only.
- No role-based access control — flat member model per PRD.
- No invite link flow — whitelist managed out-of-band for MVP (FR-003 is nice-to-have).
- No loading skeleton for the protected routes beyond a simple spinner.

## Implementation Approach

Three phases in order:

1. Auth infrastructure — the singleton, context, and provider. Everything else builds on this.
2. Login + rejection screens — the two user-facing surfaces for the unauthenticated and non-member states.
3. Route guards — the pathless layout route that enforces auth for all children.

## Critical Implementation Details

**`onAuthStateChanged` fires asynchronously.** The auth context must track a `loading: boolean` that starts `true` and flips to `false` after the first event. The protected layout route must render a spinner (not redirect) while `loading` is `true`, or authenticated users will see a flash-redirect to `/login` on every page load.

**`signInWithPopup` must originate from a user gesture.** Browsers may suppress the popup if called outside a click handler. Wire it only to the button's `onClick` — never call it in a `useEffect` or auto-trigger.

**`VITE_ALLOWED_EMAILS` is comma-separated, case-sensitive at the env level but must be lowercased before comparison.** Normalize both the env string and `user.email` to lowercase before the includes check.

---

## Phase 1: Auth Infrastructure

### Overview

Extend `firebase.ts` to export `auth` and `db` singletons. Create an `AuthContext` that wraps `onAuthStateChanged`, exposes `{ user, loading }`, and provides them to the entire app via `root.tsx`.

### Changes Required

#### 1. Extend Firebase singletons

**File**: `app/firebase.ts`

**Intent**: Add `auth` and `db` singleton exports so all feature modules import from one place. Adding `db` here (even though F-03 uses it) avoids a merge conflict when both plans are in flight simultaneously.

**Contract**: Import `getAuth` from `"firebase/auth"` and `getFirestore` from `"firebase/firestore"`. Call each with the exported `app`. Export the results as `auth` and `db`. The validation guard and `initializeApp` call remain unchanged.

#### 2. Create auth context

**File**: `app/context/auth.tsx` (new)

**Intent**: Centralize Firebase Auth state in a React context so any component can read `user` and `loading` without prop-drilling or re-subscribing to `onAuthStateChanged`.

**Contract**: Export a `AuthProvider` component and a `useAuth` hook. `AuthProvider` calls `onAuthStateChanged(auth, ...)` in a `useEffect`, stores `user` (`User | null`) and `loading` (`boolean`, initially `true`) in `useState`, and provides them via context. `useAuth` throws if called outside the provider. Unsubscribe from `onAuthStateChanged` in the `useEffect` cleanup.

#### 3. Wrap app with AuthProvider

**File**: `app/root.tsx`

**Intent**: Make auth state available to the entire component tree by wrapping `<Outlet />` inside `<AuthProvider>`.

**Contract**: Import `AuthProvider` from `~/context/auth`. In the `App()` default export, wrap the existing `<Outlet />` with `<AuthProvider>`. No other changes to `root.tsx`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0 and `build/client/index.html` exists

#### Manual Verification

- `npm run dev` starts without console errors
- Opening DevTools → Application → IndexedDB shows no Firebase Auth errors on load
- Temporarily import and log `useAuth()` from a route component; confirm `loading` starts `true` then flips to `false` after ~100 ms

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Login Route + Rejection Screen

### Overview

Create the `/login` route with a Sign-in-with-Google button and a standalone rejection screen component for non-whitelisted users. Wire `VITE_ALLOWED_EMAILS` for the whitelist check.

### Changes Required

#### 1. Add VITE_ALLOWED_EMAILS to env files

**File**: `.env.example`, `.env.local`

**Intent**: Document and populate the whitelist env var so the login flow has values to check against.

**Contract**: Add `VITE_ALLOWED_EMAILS=` to `.env.example` (empty value). Add `VITE_ALLOWED_EMAILS=your@email.com` (real comma-separated values) to `.env.local`. Also add `VITE_ALLOWED_EMAILS` to GitHub Actions secrets (same value as `.env.local`) so CI builds embed the correct list.

#### 2. Create login route

**File**: `app/routes/login.tsx` (new)

**Intent**: The landing page for unauthenticated users. Renders a "Sign in with Google" button and handles the `signInWithPopup` flow. After sign-in, checks the whitelist and either navigates to the app or renders the rejection screen.

**Contract**:
- Import `GoogleAuthProvider`, `signInWithPopup` from `"firebase/auth"` and `auth` from `~/firebase`.
- Import `useNavigate` from `"react-router"`.
- Read `import.meta.env.VITE_ALLOWED_EMAILS`, split on `,`, trim, lowercase each entry.
- On button click: call `signInWithPopup(auth, new GoogleAuthProvider())`. On resolved `UserCredential`, check `result.user.email?.toLowerCase()` against the allowed list. If allowed, `navigate("/")`. If not allowed (or email null), call `signOut(auth)` and render the rejection screen in place (or set local state to show it — see below).
- If the user is already signed in when they land on `/login` (auth context `user` is non-null and whitelisted), immediately `navigate("/")`.
- Error handling: catch `signInWithPopup` errors (e.g. `auth/popup-closed-by-user`) and show a brief inline message.

#### 3. Create rejection screen component

**File**: `app/components/RejectionScreen.tsx` (new)

**Intent**: Shown to a signed-in user whose email is not on the whitelist. Informs them they're not a member and gives them a way to sign out.

**Contract**: Accepts no props. Renders a message ("Your account is not on the member list. Contact the group admin to request access.") and a "Sign Out" button that calls `signOut(auth)` from `~/firebase` and then `navigate("/login")`.

#### 4. Register the login route

**File**: `app/routes.ts`

**Intent**: Make `/login` reachable by React Router.

**Contract**: Import `route` from `"@react-router/dev/routes"`. Add `route("login", "routes/login.tsx")` to the routes array alongside the existing `index(...)`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Navigating to `http://localhost:5173/login` shows the sign-in button
- Clicking "Sign in with Google" opens a Google OAuth popup
- Signing in with a whitelisted email navigates to `/`
- Signing in with a non-whitelisted email shows the rejection screen
- Clicking "Sign Out" on the rejection screen returns to `/login` and clears the Firebase Auth session
- Revisiting `/login` while already signed in as a whitelisted user immediately redirects to `/`

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Protected Layout Route

### Overview

Create a pathless `_protected` layout route that enforces authentication for all children. Nest the existing `home` route under it. All future app routes added to `routes.ts` under `_protected` automatically inherit the auth guard.

### Changes Required

#### 1. Create protected layout route

**File**: `app/routes/_protected.tsx` (new)

**Intent**: A pathless layout route that reads auth state and either renders its children (whitelisted member), redirects to `/login` (signed out), or shows the rejection screen (signed in but not whitelisted).

**Contract**:
- Read `{ user, loading }` from `useAuth()`.
- If `loading`: return a centered spinner (e.g. a `<div>Loading…</div>` — styling can be improved later).
- If `!user`: return `<Navigate to="/login" replace />`.
- If `user` but email not in `VITE_ALLOWED_EMAILS` split: return `<RejectionScreen />`.
- Otherwise: return `<Outlet />`.
- Do NOT call `signInWithPopup` here — this component only enforces, never initiates auth.

#### 2. Nest home route under _protected

**File**: `app/routes.ts`

**Intent**: Make the home route (and all future app routes) children of `_protected` so the guard applies automatically.

**Contract**: Import `layout` from `"@react-router/dev/routes"`. Replace the standalone `index("routes/home.tsx")` with `layout("routes/_protected.tsx", [index("routes/home.tsx")])`. The `/login` route stays at the top level (outside `_protected`).

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0

#### Manual Verification

- Visiting `http://localhost:5173/` while signed out redirects to `/login`
- Signing in with a whitelisted email lands on the home page (`/`)
- Hard-refreshing the page while signed in does NOT flash `/login` before showing the home page (confirms the `loading` guard works)
- Opening a private/incognito tab and visiting `/` redirects to `/login`
- Signing out from the rejection screen (if tested) returns to `/login`

**Implementation Note**: This is the final phase. Pause for manual confirmation, then push to GitHub — the merge workflow will deploy the updated app to Firebase Hosting.

---

## Testing Strategy

### Manual Testing Steps

1. Fresh incognito tab → visit `/` → should redirect to `/login`
2. Click "Sign in with Google" → sign in with a whitelisted email → should land on `/`
3. Hard-refresh → should stay on `/` (no flash to `/login`)
4. Sign out (add a temporary sign-out button to home.tsx for testing) → should redirect to `/login`
5. Sign in with a non-whitelisted Google account → should see rejection screen
6. Click "Sign Out" on rejection screen → should clear session and show `/login`

### Edge Cases

- `VITE_ALLOWED_EMAILS` env var absent/empty → all users see rejection screen (fail-closed, acceptable)
- `user.email` is null (shouldn't happen for Google Sign-In, but guard against it) → treat as not whitelisted
- Popup closed by user before completing OAuth → show inline "Sign-in cancelled" message, no error thrown to console

## Performance Considerations

Auth state resolution adds ~50–100 ms on first load before the protected route renders. The `loading` spinner prevents a layout shift. No additional performance concern at this scale.

## References

- Infrastructure research: `context/foundation/infrastructure.md`
- Roadmap F-02: `context/foundation/roadmap.md`
- Firebase Auth docs (via Firebase Agent Skills): `.agents/skills/firebase-auth-basics/references/client_sdk_web.md`
- Sibling plan (F-03): `context/changes/firestore-schema-and-rules/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth Infrastructure

#### Automated

- [x] 1.1 `npm run typecheck` exits 0 — 84a8ddb
- [x] 1.2 `npm run build` exits 0 — 84a8ddb

#### Manual

- [ ] 1.3 Dev server starts without console errors
- [ ] 1.4 `useAuth()` loading flag transitions true → false on load (confirmed in DevTools)

### Phase 2: Login Route + Rejection Screen

#### Automated

- [x] 2.1 `npm run typecheck` exits 0
- [x] 2.2 `npm run build` exits 0

#### Manual

- [ ] 2.3 `/login` shows sign-in button
- [ ] 2.4 Sign-in with whitelisted email navigates to `/`
- [ ] 2.5 Sign-in with non-whitelisted email shows rejection screen
- [ ] 2.6 Sign Out on rejection screen returns to `/login` with cleared session
- [ ] 2.7 Revisiting `/login` while already signed in as whitelisted user redirects to `/`

### Phase 3: Protected Layout Route

#### Automated

- [ ] 3.1 `npm run typecheck` exits 0
- [ ] 3.2 `npm run build` exits 0

#### Manual

- [ ] 3.3 Visiting `/` while signed out redirects to `/login`
- [ ] 3.4 Hard-refresh while signed in does not flash `/login`
- [ ] 3.5 Private/incognito tab visiting `/` redirects to `/login`
