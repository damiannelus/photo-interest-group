# Challenge Creation — Plan Brief

> Full plan: `context/changes/challenge-creation/plan.md`
> Research: `context/changes/challenge-creation/research.md`

## What & Why

S-05 adds the ability for any whitelisted member to create a new challenge (title + optional description) via a form at `/challenges/new`. It also closes the composite index debt left by S-01 — deploying the `(status, createdAt)` index on the `challenges` collection so the feed correctly filters to only `active` challenges.

## Starting Point

The feed page (`app/routes/challenges.tsx`) exists and works but has two `{/* TODO S-05 */}` placeholder comments where the "Create Challenge" button should be. The challenges Firestore query lacks the `where("status", "==", "active")` filter because the required composite index was never deployed (deliberately deferred to S-05 by S-01's impl-review). Auth guards, the Firebase SDK, and the `Challenge` type are all already in place.

## Desired End State

A signed-in member can click "+ New Challenge" in the feed header, fill in a title (required) and description (optional), submit the form, and be navigated back to the feed where the new challenge appears at the top. The feed shows only `active` challenges. The full creation round-trip takes one page navigation, zero page reloads.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth guard strategy | Inherit from `_protected` layout — no new code | `_protected` already guards every nested route; the new route just needs to be registered inside the layout block | Research |
| Form library | None — plain controlled inputs | Two fields; the complexity of a form library is not justified | Research |
| `description` when blank | Always write `""` (empty string) | Avoids a conditional write and `undefined` field; feed already guards it with `{challenge.description && ...}` | Research |
| On success | `navigate("/")` | Specified in S-05 contract; feed's `onSnapshot` picks up the new doc automatically | Plan (S-05 contract) |
| Index deploy timing | Phase 1 deploy, Phase 3 restore filter | Index build is async; form route (Phase 2) can proceed in parallel, but filter restore must wait for "Enabled" | Research |

## Scope

**In scope:**
- New route `app/routes/challenges.new.tsx` at `/challenges/new` with creation form
- Route registration in `app/routes.ts` inside `_protected` layout
- Replace both S-05 TODO placeholders in `challenges.tsx` with `<Link to="/challenges/new">`
- Add `challenges` composite index to `firestore.indexes.json` and deploy it
- Restore `where("status", "==", "active")` in the challenges query after index is "Enabled"

**Out of scope:**
- Challenge editing or deletion UI
- Image/file upload for challenges
- Pagination or search
- New Firestore security rules
- Firestore emulator setup

## Architecture / Approach

Pure client-side React: the form is a controlled component in a new route file. On submit, `addDoc` writes directly to the `challenges` Firestore collection (same SDK pattern as the existing `onSnapshot` reads). Auth is inherited from `_protected` — `useAuth().user.uid` is always available inside the route. After a successful write, `useNavigate()` sends the user to `/` where the existing `onSnapshot` listener automatically surfaces the new challenge without any manual refetch.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Composite Index + Feed Entry Point | `firestore.indexes.json` updated & deployed; "+ New Challenge" links in feed | Index deploy is async — must wait for "Enabled" before Phase 3 |
| 2. New Challenge Form Route | `/challenges/new` form working end-to-end; route registered | None — straightforward controlled form |
| 3. Restore Status Filter | `where("status", "==", "active")` back in challenges query | Accidentally restoring before index is "Enabled" causes Firestore error |

**Prerequisites:** Firebase project access (for `firebase deploy` and Console verification). S-01 committed on the branch (already done).  
**Estimated effort:** ~1 session across 3 phases (most of the time is waiting for the index to enable).

## Open Risks & Assumptions

- Index enable time is variable (~1–5 min typical, up to 30 min on large collections). The collection has at most a handful of documents so "Enabled" should arrive quickly.
- If `firebase deploy --only firestore:indexes` fails (e.g., project auth expired), Phase 3 is blocked until it's resolved.

## Success Criteria (Summary)

- A whitelisted member can create a new challenge via the form and see it in the feed immediately
- The feed shows only `active` challenges (no closed ones leak through)
- DevTools console shows zero Firestore errors across the full creation flow
