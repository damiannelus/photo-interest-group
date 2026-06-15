---
project: "Photo Interest Group"
version: 1
status: draft
created: 2026-06-14
updated: 2026-06-15
prd_version: 1
main_goal: speed
top_blocker: skills
---

# Roadmap: Photo Interest Group

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Photo-sharing platforms make self-reflection optional; this one makes it mandatory. A closed group of ~5–15 photographers shares work through a tool that blocks publishing until the photographer writes at least 50 characters about what they were attempting — transforming a gallery into a structured learning space. The core product hypothesis — that forcing photographers to articulate their intent before sharing creates deeper engagement with each other's work — is proven or disproven the moment a real member completes the first submission.

## North star

**S-02: Reflection-gated submission in shared feed** — the smallest end-to-end flow (sign in → view challenge → submit photo + 50-char reflection → see it appear in the feed) that proves the core product hypothesis holds and the reflection gate cannot be bypassed.

> The north star is the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID    | Change ID                   | Outcome (user can …)                                                                      | Prerequisites | PRD refs                         | Status   |
| ----- | --------------------------- | ----------------------------------------------------------------------------------------- | ------------- | -------------------------------- | -------- |
| F-01  | firebase-deploy-scaffold    | (foundation) Firebase SDK initialized; firebase.json + CI/CD wired                        | —             | FR-001, FR-002, NFR: unauth      | done     |
| F-02  | auth-whitelist-gate         | (foundation) Google Sign-In live; whitelist gate active; all routes guarded               | F-01          | FR-001, FR-002                   | done     |
| F-03  | firestore-schema-and-rules  | (foundation) Firestore collections defined; security rules enforce whitelist               | F-01          | FR-004–012, NFR: unauth          | done     |
| S-01  | challenge-submission-feed   | view active challenges and their submissions in the main feed                             | F-02, F-03    | FR-004, FR-008                   | done     |
| S-05  | challenge-creation          | create a new challenge with a title and description                                       | F-02, F-03    | FR-005                           | done     |
| S-02  | reflection-gated-submission | submit a photo (URL) to a challenge with a 50-char reflection; see it in the feed immediately | S-01      | FR-006, FR-007, FR-008, US-01    | done     |
| S-03  | follow-up-submission        | initiate a follow-up from an existing submission; parent context pre-filled; parent ID stored | S-02      | FR-009, FR-010                   | proposed |
| S-04  | submission-comments         | post a text comment on any submission and view all comments                               | S-02          | FR-011, FR-012                   | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                                        | Note                                                                        |
| ------ | ---------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| A      | Auth & submission flow | `F-01` → `F-02` → `S-01` → `S-02` → `S-03` | Main sequential chain driving the north star (S-02); F-03 joins at S-01    |
| B      | Firestore schema       | `F-03`                                       | Branches from F-01 in parallel with F-02; joins Stream A at S-01            |
| C      | Challenge creation     | `S-05`                                       | Parallel with S-01; branches off once F-02 + F-03 complete                  |
| D      | Comments               | `S-04`                                       | Parallel with S-03; branches off S-02 once the north star is reached        |

## Baseline

What's already in place in the codebase as of 2026-06-14 (auto-researched + user-confirmed). Foundations below assume these layers are present and do NOT re-scaffold them.

- **Frontend:** present — React 19 + React Router 7.16 + Tailwind CSS; file-based routing in `app/routes/`; SSR enabled (`react-router.config.ts`)
- **Backend / API:** partial — React Router full-stack scaffold with SSR; no loaders, actions, or API handlers defined yet
- **Data:** absent — no Firebase/Firestore SDK, no collections, no schema
- **Auth:** absent — no Firebase Auth SDK, no OAuth integration, no route guards
- **Deploy / infra:** partial — `Dockerfile` present; `firebase.json` and `.github/workflows/` absent
- **Observability:** absent — no logging, error tracking, or metrics

## Foundations

### F-01: Firebase + deploy scaffold

- **Outcome:** (foundation) Firebase SDK initialized in the React Router app; `firebase.json` configured for the chosen deploy target; GitHub Actions CI/CD wired for auto-deploy on merge.
- **Change ID:** firebase-deploy-scaffold
- **PRD refs:** FR-001, FR-002 (both require a live Firebase project); NFR: no unauthenticated access (Firestore security rules on a deployed project are the server-side enforcement layer)
- **Unlocks:** F-02 (Firebase Auth SDK can be initialized), F-03 (Firestore SDK can be initialized)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** The bootstrapped scaffold has `ssr: true` in `react-router.config.ts`, but `tech-stack.md` describes deployment to Firebase Hosting as a static-export SPA. Whether to disable SSR (simpler path: all access control via Firestore security rules) or add Firebase Functions for the SSR runtime must be decided before F-02 and F-03 can be wired correctly. Owner: user. Block: no (disabling SSR is the lower-risk default for a private member app at this scale — Firestore security rules handle server-side enforcement without needing a Node runtime).
- **Risk:** The SSR vs. static-export decision cascades into how every React Router loader and action works; resolving it in F-01 prevents rework across all downstream slices. The `can_judge_agent: false` flag in `tech-stack.md` signals that React Router v7 patterns are new to the builder — this is the highest-risk sequencing call in the roadmap.
- **Status:** done

### F-02: Auth + whitelist gate

- **Outcome:** (foundation) Google Sign-In flow live; users whose email is not on the whitelist see a rejection screen and cannot access the app; all app routes are behind an auth guard.
- **Change ID:** auth-whitelist-gate
- **PRD refs:** FR-001, FR-002
- **Unlocks:** S-01, S-02, S-03, S-04, S-05 — every vertical slice requires an authenticated, whitelisted session
- **Prerequisites:** F-01
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:** Where is the whitelist stored — a Firestore `whitelist` collection (requires F-03 initialized first) or an environment-variable email array (allows F-02 to run fully in parallel with F-03)? Owner: user. Block: no (env-var array is sufficient for a ≤15-member MVP and preserves the parallel execution path; Firestore-backed whitelist can be wired later).
- **Risk:** Sequenced after F-01 to avoid wiring Firebase Auth before the SDK initialization is confirmed working in the chosen deploy target; an auth flow wired to a misconfigured Firebase project fails silently.
- **Status:** done

### F-03: Firestore schema + security rules

- **Outcome:** (foundation) Firestore collections defined (challenges, submissions, comments); security rules enforce that only authenticated, whitelisted users can read or write any document; one seed challenge present for downstream slice testing.
- **Change ID:** firestore-schema-and-rules
- **PRD refs:** FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012; NFR: no submission or user data accessible to unauthenticated users or non-whitelisted authenticated users — not via the UI and not via a direct Firestore URL
- **Unlocks:** S-01, S-02, S-03, S-04, S-05 — every vertical slice reads or writes Firestore; security rules are the server-side enforcement layer for the data-access NFR
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Firestore security rules are the sole server-side enforcement of all data-access NFRs in a static-export SPA (no server middleware to intercept requests); getting them wrong leaves data readable by anyone with the Firebase project URL even if the UI is correct. Sequenced as a foundation — not buried in a slice — for this reason.
- **Status:** done

## Slices

### S-01: Challenge + submission feed

- **Outcome:** user can view a list of active challenges and, for each challenge, see all submissions by members.
- **Change ID:** challenge-submission-feed
- **PRD refs:** FR-004, FR-008
- **Prerequisites:** F-02, F-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced before S-02 (submission) because the submission form opens from within a challenge context (step 3 of the 7-step Success Criteria flow); a seed challenge from F-03 makes this slice testable without S-05 (create challenge) being complete.
- **Status:** done

### S-05: Challenge creation

- **Outcome:** user can create a new challenge with a title and description, visible immediately to all members.
- **Change ID:** challenge-creation
- **PRD refs:** FR-005
- **Prerequisites:** F-02, F-03
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Parallel with S-01 because both share the same Prerequisites (F-02 + F-03) and neither depends on the other; a seeded challenge from F-03 decouples S-01's testability from this slice.
- **Status:** done

### S-02: Reflection-gated photo submission *(north star)*

- **Outcome:** user can submit a photo (by URL) to a challenge with a reflection of at least 50 characters; the "Publish" button is disabled until both conditions are met; the submission appears in the feed immediately after publishing without a page refresh.
- **Change ID:** reflection-gated-submission
- **PRD refs:** FR-006, FR-007, FR-008, US-01
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The 50-character reflection gate must be enforced both client-side (disabled Publish button) and server-side (Firestore write rejected if reflection is absent or under threshold); a slice that enforces only one layer violates the Success Criteria guardrail and is treated as a critical bug. Sequenced after S-01 so the challenge-in-context flow (click "Submit Photo" on a challenge) is already working when this slice is planned.
- **Status:** done

### S-03: Follow-up submission

- **Outcome:** user can initiate a follow-up submission from any existing submission; the parent challenge and parent photo URL are pre-filled in the form; the follow-up records the parent submission's ID.
- **Change ID:** follow-up-submission
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** `parent_submission_id` integrity is a hard guardrail in the Success Criteria ("broken parent links are treated as critical bugs, not UI issues"); sequenced after S-02 so a real parent submission exists for end-to-end testing of the chain relationship.
- **Status:** proposed

### S-04: Submission comments

- **Outcome:** user can post a text comment on any submission and view all existing comments on that submission.
- **Change ID:** submission-comments
- **PRD refs:** FR-011, FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends on S-02 so at least one real published submission exists for testing the comment flow end-to-end; parallel with S-03 since neither depends on the other.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                             | Ready for `/10x-plan` | Notes                              |
| ---------- | --------------------------- | ------------------------------------------------- | --------------------- | ---------------------------------- |
| F-01       | firebase-deploy-scaffold    | Wire Firebase SDK, hosting config, and CI/CD      | yes                   | Run `/10x-plan firebase-deploy-scaffold` |
| F-02       | auth-whitelist-gate         | Google Sign-In + whitelist gate                   | yes                   | F-01 complete                      |
| F-03       | firestore-schema-and-rules  | Firestore collections, security rules, seed data  | yes                   | F-01 complete; parallel with F-02  |
| S-01       | challenge-submission-feed   | Challenge + submission feed (read view)           | no                    | Requires F-02 + F-03               |
| S-05       | challenge-creation          | Create a new challenge                            | no                    | Requires F-02 + F-03; parallel with S-01 |
| S-02       | reflection-gated-submission | Reflection-gated photo submission (north star)    | no                    | Requires S-01                      |
| S-03       | follow-up-submission        | Follow-up submission with parent context          | no                    | Requires S-02; parallel with S-04  |
| S-04       | submission-comments         | Post and view comments on a submission            | no                    | Requires S-02; parallel with S-03  |

## Open Roadmap Questions

1. ~~**SSR vs. static export for Firebase Hosting**~~ — **Resolved in F-01**: `ssr: false` set in `react-router.config.ts`; static SPA deployed to Firebase Hosting. All access control via Firestore Security Rules.
2. **Whitelist storage** — Firestore `whitelist` collection vs. environment-variable email array for MVP. Owner: user. Block: F-02 (affects whether F-02 can run fully in parallel with F-03, or must sequence after it).

## Parked

- **Browse past challenges and submission history (FR-013)** — Why parked: explicitly nice-to-have in PRD; main feed serves the primary MVP need; deferred to keep the 1-week scope tight.
- **Single-use invite links (FR-003)** — Why parked: downgraded from must-have during PRD shaping; whitelist managed out-of-band (Firestore console or config) for MVP; PRD §Access Control: "Out of scope for the 1-week MVP."
- **Native mobile app** — Why parked: PRD §Non-Goals; MVP is web-only.
- **Likes, reactions, or voting** — Why parked: PRD §Non-Goals; feedback is text-only (comments) by design.
- **Public-facing content / share links** — Why parked: PRD §Non-Goals; all content is private to whitelisted members.

## Done

- **F-01: (foundation) Firebase SDK initialized; firebase.json + CI/CD wired** — Archived 2026-06-15 → `context/archive/2026-06-14-firebase-deploy-scaffold/`. Lesson: —.
- **F-02: (foundation) Google Sign-In live; whitelist gate active; all routes guarded** — Archived 2026-06-15 → `context/archive/2026-06-15-auth-whitelist-gate/`. Lesson: —.
- **F-03: (foundation) Firestore collections defined (challenges, submissions, comments); security rules enforce that only authenticated, whitelisted users can read or write any document; one seed challenge present for downstream slice testing.** — Archived 2026-06-15 → `context/archive/2026-06-15-firestore-schema-and-rules/`. Lesson: —.
- **S-01: view active challenges and their submissions in the main feed** — Archived 2026-06-15 → `context/archive/2026-06-15-challenge-submission-feed/`. Lesson: —.
- **S-05: create a new challenge with a title and description** — Archived 2026-06-15 → `context/archive/2026-06-15-challenge-creation/`. Lesson: —.
- **S-02: user can submit a photo (by URL) to a challenge with a reflection of at least 50 characters; the "Publish" button is disabled until both conditions are met; the submission appears in the feed immediately after publishing without a page refresh.** — Archived 2026-06-15 → `context/archive/2026-06-15-reflection-gated-submission/`. Lesson: —.
