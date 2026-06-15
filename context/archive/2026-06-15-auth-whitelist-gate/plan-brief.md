# Auth + Whitelist Gate — Plan Brief

> Full plan: `context/changes/auth-whitelist-gate/plan.md`

## What & Why

Wire Google Sign-In (Firebase Auth) into the React Router v7 SPA and restrict access to a pre-approved member list. Every route in the app requires an authenticated, whitelisted session — unauthenticated visitors see a login page, and signed-in non-members see a rejection screen. This is the prerequisite for every downstream slice (S-01 through S-05).

## Starting Point

The app is a greenfield static SPA with one route (`home.tsx`) and no auth code. `firebase.ts` exports only the initialized `app` instance; no `auth` singleton exists yet.

## Desired End State

Visiting any app URL while signed out redirects to `/login`. A "Sign in with Google" button triggers `signInWithPopup`; on success, the user's email is checked against `VITE_ALLOWED_EMAILS`. Whitelisted members reach the app; non-members see a full rejection screen with a Sign Out button.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Sign-in method | `signInWithPopup` | No page-navigation needed; avoids `getRedirectResult` boot-time async gap | Research |
| Whitelist storage (UI) | `VITE_ALLOWED_EMAILS` env var | No Firestore read on load; F-02 stays fully parallel with F-03 | Plan |
| Auth state container | React context + `onAuthStateChanged` | Firebase user is null synchronously on load; `loading` flag prevents flash-redirect | Research |
| Route guard pattern | Pathless `_protected` layout route | Single guard point; all future routes auto-inherit by nesting under it | Research |
| Rejection UX | Full-page screen + Sign Out button | Clear and actionable; user knows why they're blocked | Plan |
| `firebase.ts` shape | Exports `app`, `auth`, `db` (all three) | Avoids merge conflict with F-03 running in parallel | Plan |

## Scope

**In scope:** Firebase Auth SDK wiring, `AuthProvider` + `useAuth`, `/login` route, rejection screen, `_protected` layout route, `VITE_ALLOWED_EMAILS` env var

**Out of scope:** Firestore whitelist in the UI, email/password auth, roles, invite links, session persistence customization

## Architecture / Approach

`app/firebase.ts` gains `auth` and `db` singletons. `app/context/auth.tsx` subscribes to `onAuthStateChanged` and provides `{ user, loading }` to the tree via `AuthProvider` (mounted in `root.tsx`). A pathless `_protected.tsx` layout route reads from `useAuth`: if loading → spinner; if no user → redirect to `/login`; if user but not whitelisted → `<RejectionScreen />`; otherwise → `<Outlet />`. The `/login` route is a sibling of `_protected` (unguarded).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Auth Infrastructure | `firebase.ts` singletons, `AuthContext`, `AuthProvider` in root | `loading` flag must start `true` or users get flash-redirected on every load |
| 2. Login + Rejection screens | `/login` route, `RejectionScreen`, `VITE_ALLOWED_EMAILS` wiring | `signInWithPopup` must be called only from a click handler |
| 3. Protected Layout Route | `_protected.tsx`, updated `routes.ts` | Nesting must be correct — `layout()` wraps `index()` in routes.ts |

**Prerequisites:** F-01 complete (Firebase SDK installed, `firebase.ts` exists)
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- `VITE_ALLOWED_EMAILS` is the UI gate only — the real security gate is Firestore Security Rules (F-03). Both must be deployed before the app is considered secure.
- Member emails in `VITE_ALLOWED_EMAILS` must be lowercased to match Google's email normalization; the comparison must be case-insensitive.
- F-02 and F-03 both touch `firebase.ts` — the one implemented second must check whether `db`/`auth` is already exported before adding it.

## Success Criteria (Summary)

- Visiting `/` while signed out → redirected to `/login`
- Whitelisted Google account signs in → lands on home page, no flash
- Non-whitelisted Google account signs in → sees rejection screen, can sign out
