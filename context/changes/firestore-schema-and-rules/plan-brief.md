# Firestore Schema + Security Rules — Plan Brief

> Full plan: `context/changes/firestore-schema-and-rules/plan.md`

## What & Why

Define the Firestore data model for the app and deploy security rules that make it the sole server-side enforcement layer for the PRD's data-access NFR. In a static SPA with no server runtime, Firestore rules are what stand between member data and the open internet — getting them wrong exposes all data to anyone with the Firebase project URL, even if the UI is correct.

## Starting Point

Firebase project `photo-interest-group` is live on Blaze. No Firestore SDK is used anywhere in the app. No `firestore.rules` file exists. `firebase.json` has only a `"hosting"` key.

## Desired End State

`firestore.rules` is committed to the repo and deployed. Only authenticated users whose email exists in `/members/{email}` can read or write any data. Submission creates are rejected server-side if `reflection.size() < 50`. One seed challenge exists in `/challenges` for downstream slice testing.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Whitelist in rules | `/members/{email}` collection (email as doc ID) | Pre-seedable before any member signs in; one existence check in rules | Research |
| Comments storage | Subcollection of submissions | Co-locates data, inherits parent security context, simplifies queries | Research |
| `parent_submission_id` | Nullable string field on submissions | Flat and queryable; null for roots, parent doc ID for follow-ups | Research |
| 50-char gate location | Firestore rules (F-03) not S-02 | Server-side enforcement in rules means S-02 can't bypass it; rules are deployed once | Plan |
| Rules deployment | `firestore.rules` file + CLI deploy | Version-controlled, reviewable in PRs, CI-deployable | Plan |
| Members seeding | Firebase Console UI | No scripts needed for 5–15 members; works before anyone signs in | Plan |
| Seed challenge | Firebase Console UI | Zero code; one document for downstream testing | Plan |

## Scope

**In scope:** `firestore.rules` with challenges + submissions + comments + members rules, `firebase.json` `firestore` key, `db` export in `firebase.ts`, `/members` seeding, one seed challenge

**Out of scope:** Firestore SDK in React components (S-01+), Firebase Storage, Cloud Functions, invite-link management, composite indexes, Emulator Suite

## Architecture / Approach

Three Firestore collections: `/challenges`, `/submissions` (with `parent_submission_id: string | null`), and `/submissions/{id}/comments` (subcollection). A `/members/{email}` collection stores whitelisted emails as document IDs. The `isWhitelisted()` helper function in rules checks `exists(/databases/$(database)/documents/members/$(request.auth.token.email))` — one existence check, no data read, no billing impact. The 50-char gate is `request.resource.data.reflection.size() >= 50` on submissions create.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Firestore Config + Rules File | `firestore.rules`, updated `firebase.json`, `db` export in `firebase.ts` | Rules must be tested in a real browser session (not just the Rules Playground) to validate `token.email` claims |
| 2. Deploy + Seed Data | Live rules deployed, `/members` seeded, seed challenge created | Seed order matters — member docs must exist before testing the whitelist check |

**Prerequisites:** F-01 complete; F-02 Phase 1 recommended (provides `db` export) but not required
**Estimated effort:** ~1 short session (Phase 1 is code; Phase 2 is Firebase Console UI)

## Open Risks & Assumptions

- `request.auth.token.email` is reliably populated for Google Sign-In; if a non-Google provider is added post-MVP, rules need revisiting.
- The `members` collection is write-disabled from client SDKs — only the Firebase Console can add members. This is intentional for MVP.
- F-02 and F-03 both touch `firebase.ts` — check whether `db` is already exported before adding it (F-02 Phase 1 adds it if run first).
- Rules changes are not automatically deployed by the GitHub Actions merge workflow (it only deploys Hosting). A separate `firebase deploy --only firestore:rules` step is needed after each rules change.

## Success Criteria (Summary)

- `firebase deploy --only firestore:rules` exits 0 and rules appear in Firebase Console
- Unauthenticated Firestore reads are denied (tested via browser DevTools)
- Submission write with reflection < 50 chars is denied server-side
- `/members/{your-email}` and one `/challenges/{seed-id}` document exist in Firestore Console
