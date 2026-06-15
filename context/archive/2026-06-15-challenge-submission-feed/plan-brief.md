# Challenge + Submission Feed — Plan Brief

> Full plan: `context/changes/challenge-submission-feed/plan.md`
> Research: `context/changes/challenge-submission-feed/research.md`

## What & Why

S-01 builds the main read-only feed at `/` — a list of active challenges, each showing its members' submissions. This is the first vertical slice of the app and the direct prerequisite for S-02 (the north star: reflection-gated submission). Without a working feed, members have no context to submit into, and S-02 cannot be tested end-to-end.

## Starting Point

Auth (F-02) and Firestore schema + rules (F-03) are both complete and deployed. `db`, `auth`, and `useAuth()` are all available. The current index route at `/` renders the boilerplate `<Welcome />` component from the React Router scaffold — there is no real content or data loading in the app yet.

## Desired End State

A whitelisted member signs in and immediately sees a live feed of active challenges. Each challenge shows its title, description, and inline list of submissions (photo, author, reflection excerpt). The feed updates in real-time when submissions are added. Two placeholder comments mark where S-05's "Create Challenge" button and S-02's "Submit Photo" button will be wired in future slices.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Route path | `/` replacing `home.tsx` | Home is boilerplate with no content; replacing it is cleaner than adding a redirect | Research / Plan |
| Data loading pattern | `onSnapshot` (real-time) | S-02 requires submissions to appear without page refresh — establish the pattern now | Research |
| Submission loading | All submissions per challenge, upfront | 5–15 members means trivial data volume; no pagination complexity needed for MVP | Research / Plan |
| Composite index | `firestore.indexes.json` committed to repo | Infra-as-code keeps the index tracked and deployable via CLI, matching the rules pattern | Plan |
| TypeScript types location | `app/types/challenge.ts` + `app/types/submission.ts` | S-05 will import `Challenge` from this file — must be created by S-01 as a shared contract | Task instructions |
| `home.tsx` | Delete (not just de-register) | Avoids confusion from a file that is registered nowhere but still exists in the repo | Plan |

## Scope

**In scope:**
- `app/types/challenge.ts` and `app/types/submission.ts` (new shared type files)
- `firestore.indexes.json` (new, declares composite index)
- `firebase.json` update (add `"indexes"` key to `"firestore"` block)
- `app/routes/challenges.tsx` (new index route replacing `home.tsx`)
- `app/routes.ts` update (replace `home.tsx` with `challenges.tsx`)
- Delete `app/routes/home.tsx`
- Loading, empty, and error states for the feed

**Out of scope:**
- Challenge creation UI (S-05)
- Submission form (S-02)
- Comments display (S-04)
- Follow-up submission linking (S-03)
- Pagination
- Closed challenges
- Photo upload / Firebase Storage

## Architecture / Approach

Static SPA with direct Firestore SDK calls — no loaders, no server. The feed component mounts a top-level `onSnapshot` listener for active challenges, then each challenge card mounts its own `onSnapshot` listener for its submissions. All listeners are cleaned up on unmount. TypeScript types in `app/types/` serve as the shared data contract between S-01 (read) and S-05 (write). The composite index in `firestore.indexes.json` enables the `challengeId + createdAt` query on `submissions`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. TypeScript Types + Firestore Index | `app/types/` files, `firestore.indexes.json`, `firebase.json` update, index deployed | Index deployment must complete before Phase 2 browser testing — "Enabled" status can take 1–2 min |
| 2. Feed Route + Data Layer | `challenges.tsx` as new index route, live `onSnapshot` feed, `routes.ts` updated | Composite index must be "Enabled" before testing; `onSnapshot` cleanup must be correct to avoid leaks |
| 3. UI Polish + Error States | Loading/empty/error states, Tailwind layout, mobile + dark mode | Purely presentational — low risk |

**Prerequisites:** F-02 (auth) and F-03 (Firestore schema + rules) complete — both done. Firebase CLI authenticated locally for index deploy.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Composite index "Enabled" status in Firebase Console may take 1–2 minutes after deploy — Phase 2 browser testing must wait for it.
- `photoUrl` may be a broken image URL for seed/test data — acceptable for MVP (browser broken-image icon shown).
- S-05 is planned as a parallel slice; S-05 must import `Challenge` from `~/types/challenge` without modifying the file — the type shape in Phase 1 is a shared contract.

## Success Criteria (Summary)

- Whitelisted member visits `/`, sees "First Light" seed challenge with any existing submissions, no console errors
- Adding a submission in Firebase Console causes it to appear in the feed without a page refresh
- `npm run typecheck` and `npm run build` both exit 0 after each phase
