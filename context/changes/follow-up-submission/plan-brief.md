# Follow-Up Submission — Plan Brief

> Full plan: `context/changes/follow-up-submission/plan.md`

## What & Why

Add the Follow-Up Submission feature (PRD FR-009, FR-010): any member can click "Follow-Up" on any submission to open an inline form, see the parent's context, write their own photo + reflection, and publish a linked submission. This completes step 6 of the 7-step MVP flow and enables the "chain of creative responses" that is the product's core differentiator. Also fixes a pre-existing trim-inconsistency bug in the root submission form (flagged in `lessons.md`).

## Starting Point

`app/routes/challenges.tsx` has `SubmissionCard` (shows photo + reflection + inline comment form) and `ChallengeCard` (manages the flat submissions list + root submission form). The `Submission` type already declares `parent_submission_id: string | null` but it is never written or displayed. Submissions render as a flat chronological list with no chain hierarchy.

## Desired End State

Every `SubmissionCard` has a "Follow-Up" button that opens an inline form showing the parent's photo, author, and reflection excerpt above a new photo URL input and reflection textarea. Publishing creates a Firestore submission with `parent_submission_id` set. The feed renders follow-ups indented under their parent with a left-border connector, expanded by default, at unlimited depth (visual indent capped at 3 levels).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Form placement | Inline in SubmissionCard | Consistent with the existing comment form pattern — no modal infrastructure needed |
| Parent context shown | Thumbnail + author + ~80-char reflection excerpt | Enough context to orient the responder without dominating the form |
| Chain display | Indented under parent, expanded by default | Makes the chain-of-inspiration model immediately legible — hiding it by default undercuts the product value |
| Chain depth | Unlimited (visual cap at 3 indent levels) | Matches PRD intent; depth cap prevents layout breakage on narrow screens |
| Self-follow-up | Allowed | Consistent with the flat role model; supports documenting creative progression |
| Trim bug fix | In scope (Phase 1) | `lessons.md` rule says fix it wherever encountered; the follow-up form must be correct from day one |

## Scope

**In scope:**
- "Follow-Up" button + inline form in `SubmissionCard`
- Compact read-only parent context block in the form
- `parent_submission_id` written on follow-up submissions; `null` written on root submissions
- Recursive `SubmissionList` tree renderer replacing the flat list in `ChallengeCard`
- Fix `ChallengeCard` reflection counter trim inconsistency

**Out of scope:**
- Collapse/expand toggle for chains
- Restrictions on self-follow-up
- Invite or whitelist UI
- Firestore security rule changes
- Shared submission form component extraction

## Architecture / Approach

All changes are in `app/routes/challenges.tsx`. A new module-level `buildSubmissionTree` function groups a flat `Submission[]` into a `Map<string | null, Submission[]>` keyed by `parent_submission_id ?? null`. A new `SubmissionList` component renders each group recursively, adding indent CSS at each depth level (capped at 3). `SubmissionCard` gains follow-up state and a form that mirrors the existing comment form pattern, with HTTPS URL validation and a trim-consistent 50-char reflection gate. No new routes, types, or Firestore collections.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Trim Fix & Root Parent ID | Corrects counter bug; all new root submissions write `parent_submission_id: null` | Low — isolated to two lines + one payload field |
| 2. Follow-Up Form in SubmissionCard | Follow-Up button, parent context block, inline form, Firestore write with `parent_submission_id` | Medium — lots of state in SubmissionCard; must handle mutual exclusion with comment form |
| 3. Chain Tree Rendering | Recursive `SubmissionList`, visual connectors, depth cap | Medium — tree-build must handle pre-existing docs without the field (`?? null`) |

**Prerequisites:** None — `parent_submission_id` is already in the type; no Firestore index changes needed (queries unchanged).  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Pre-existing Firestore documents without `parent_submission_id` must be treated as roots via `?? null` in the tree-build — if this guard is missed, those submissions disappear from the feed.
- Deep chains on narrow screens could still look cramped at 3 levels of indentation (each level adds ~32px); acceptable at the 5–15 member group size.

## Success Criteria (Summary)

- A follow-up submission appears in the feed indented under its parent, with `parent_submission_id` correctly stored in Firestore.
- The chain renders at unlimited depth without dropping any submissions.
- The trim bug is fixed: whitespace-only input in any reflection field shows "0 / 50 characters" and keeps the Publish button disabled.
