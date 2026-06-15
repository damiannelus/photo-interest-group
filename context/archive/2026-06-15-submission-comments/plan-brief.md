# Submission Comments — Plan Brief

> Full plan: `context/changes/submission-comments/plan.md`

## What & Why

Add the ability for whitelisted members to post text comments on any submission and view existing comments in real-time (FR-011, FR-012). Comments transform the feed from a one-way gallery into the structured dialogue the PRD envisions — members can respond to each other's work and reflections directly on the submission card.

## Starting Point

The Firestore infrastructure for comments is 100% complete: the `/submissions/{id}/comments` subcollection is defined, security rules are deployed (whitelist-gated, author-delete, immutable), and S-02 (reflection-gated submission) is done — real published submissions exist for end-to-end testing. The only gap is the UI layer in `challenges.tsx`.

## Desired End State

Every submission card in the feed shows a "Comments (N)" toggle button. Clicking it expands a real-time comment thread (oldest first) with a form at the bottom for posting. Authors see a delete button on their own comments. The count badge updates live once the section is open, and the initial count is fetched on card mount without requiring expansion.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Comment display | Toggle (collapsed by default) | Keeps feed scannable; matches the submit-photo toggle pattern already in `ChallengeCard` |
| Listener activation | Lazy (on toggle-open only) | Avoids 10+ concurrent Firestore listeners for all visible submissions; fine at MVP scale |
| Comment ordering | Oldest first (ascending) | Natural conversational flow — reads like a forum thread |
| Delete UI | Yes, author-only | Handles accidental posts; rules already support it; zero new rule changes |
| Comment minimum | 10 characters | PRD has no minimum for comments; 10 chars nudges substance over single-word reactions |
| Count badge | Yes, shown in toggle button | Signals conversation at a glance, driving engagement |
| Count fetch strategy | `getCountFromServer` on mount + live count from snapshot once expanded | No extra persistent listener; count transitions seamlessly from aggregate to live |
| Form placement | Below the comment list | Conversational reading order — read the thread, then reply |

## Scope

**In scope:**
- `Comment` TypeScript type (`app/types/comment.ts`)
- `SubmissionCard` component extracted from `ChallengeCard`'s inline submission rendering
- Comment count badge via `getCountFromServer` on mount
- Real-time comment list via `onSnapshot` when expanded
- Comment form (10-char min, `addDoc`, `serverTimestamp`)
- Author delete (`deleteDoc`)
- Loading / empty / error states
- Tailwind dark mode + mobile layout

**Out of scope:**
- Comment editing (Firestore rules have no `allow update`)
- Comment threading / replies
- Comment pagination
- Delete confirmation dialog
- Server-side comment length enforcement (client-side gate only)
- New routes or Firestore index changes

## Architecture / Approach

The key structural move is extracting `SubmissionCard` from `ChallengeCard`'s `.map()` rendering. Each `SubmissionCard` instance independently manages: initial count fetch (`getCountFromServer` on mount), lazy `onSnapshot` listener (keyed on `commentOpen` state), comment form state, and delete handler. This mirrors how `ChallengeCard` was extracted from `ChallengeFeed` in S-01 — isolating per-item Firestore subscription state in a child component whose lifecycle React manages automatically. All Firestore ops use the established modular v12 API (`collection`, `onSnapshot`, `addDoc`, `deleteDoc`, `serverTimestamp`, `getCountFromServer`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Comment Type | `app/types/comment.ts` with Comment interface | None — trivial but blocks Phase 2 |
| 2. SubmissionCard + Core Comments | Full comment feature: count badge, toggle, real-time thread, post form, author delete | Component extraction must not break existing submission display |
| 3. Polish + Error States | Loading/empty states, character counter color, dark mode, mobile layout | Regression in existing submission form or challenge card styling |

**Prerequisites:** S-02 must be done (at least one real published submission in Firestore for end-to-end testing). Confirmed: S-02 is archived and deployed.
**Estimated effort:** ~1–2 sessions; 3 phases. Phase 2 is the bulk of the work.

## Open Risks & Assumptions

- `getCountFromServer` is available in the installed Firebase SDK version (requires v9.12.0+; project uses Firebase SDK v12 modular — confirmed available).
- If `SubmissionCard` extraction touches the same lines as any in-progress S-03 (follow-up submission) work, there may be a merge conflict in `challenges.tsx`. S-03 and S-04 are parallel; coordinate if both are being developed simultaneously.

## Success Criteria (Summary)

- A whitelisted member can post a comment on any submission and see it appear in the feed in real-time without a page refresh.
- The "Comments (N)" count badge is visible on every submission card without requiring the section to be expanded.
- A member can delete their own comments; the count updates accordingly.
