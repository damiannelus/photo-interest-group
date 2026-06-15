# Reflection-Gated Photo Submission — Plan Brief

> Full plan: `context/changes/reflection-gated-submission/plan.md`

## What & Why

Add the submission form to the main feed — a "Submit Photo" button on each ChallengeCard that expands an inline form requiring a hosted photo URL and a reflection of at least 50 characters before the "Publish" button becomes active. This is the north star slice (S-02): the smallest end-to-end flow that proves the core product hypothesis — that forcing photographers to articulate their intent before sharing creates deeper engagement — and verifies the reflection gate cannot be bypassed.

## Starting Point

All infrastructure for submissions is already in place: the `submissions` Firestore collection is live, security rules enforce `reflection.size() >= 50` on every write, the `Submission` TypeScript type is defined, and `ChallengeCard` in `challenges.tsx` already listens to submissions in real-time via `onSnapshot`. Two `TODO S-02` comment markers sit exactly where the submit button belongs.

## Desired End State

A whitelisted member can click "Submit Photo" on any active challenge, paste a hosted image URL, write a reflection of at least 50 characters, and publish. The submission appears instantly in the challenge card's feed — no page refresh, no redirect. The Publish button stays disabled until both conditions are met, and Firestore rejects any write that bypasses the client-side check.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Form trigger | Inline expand on ChallengeCard | Keeps challenge context visible; simpler than a new route; existing ChallengeCard infrastructure makes it natural | Plan |
| Reflection feedback | Live character counter (gray → green at ≥50) | User needs to know how close they are; bare button state alone causes confusion with a 50-char minimum | Plan |
| Photo feedback | Live `<img>` preview on URL paste | Immediate visual confirmation before committing; broken-image fallback already accepted in the feed | Plan |
| Success UX | Form collapses; submission appears in feed | The appearing submission IS the confirmation; no toast or redirect needed | Plan |
| `parent_submission_id` | `null` for all S-02 submissions | S-03 (follow-up) handles the non-null case; S-02 is root submissions only | Plan |
| No new route | Form is inline in `ChallengeCard` | Avoids a parameterized route and navigation; all data (challenge.id, user) already available in the card | Plan |

## Scope

**In scope:**
- "Submit Photo" toggle button in each ChallengeCard header
- Inline form: photo URL input + live preview, reflection textarea + character counter, Publish/Cancel buttons
- `addDoc` write to `/submissions` with all required fields
- Form reset and collapse on successful publish
- Error message on Firestore write failure
- Dark mode and mobile layout consistency

**Out of scope:**
- New route or modal overlay
- Photo URL validation beyond non-empty (no MIME check)
- Toast notification on success
- Edit or delete of published submissions
- `parent_submission_id` linking (S-03)
- Comments (S-04)
- Firestore rule changes (already deployed)

## Architecture / Approach

`ChallengeCard` in `app/routes/challenges.tsx` gains five new state variables (`formOpen`, `photoUrl`, `reflection`, `submitting`, `submitError`) and a derived `canPublish` constant. The `TODO S-02` header slot becomes a toggle button; the inline form renders conditionally when `formOpen` is true. On submit, `addDoc` writes to `/submissions`; the existing `onSnapshot` subscription picks up the new document within ~1 second. No new files, no new routes, no infrastructure changes — S-02 is a targeted addition to one existing component.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Core Submission Form | End-to-end submission flow working: button → form → addDoc → submission appears in feed | Form state isolation per card (multiple open simultaneously) — handled by keeping all state local to each ChallengeCard instance |
| 2. Polish + Error States | Character counter color, loading label, dark mode, mobile layout, error message on failure | None significant — purely presentational |

**Prerequisites:** S-01 (challenge feed) done ✓; Firebase Auth, Firestore rules, `Submission` type, `onSnapshot` listener all in place ✓  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Photo URLs are assumed to be publicly accessible hosted images. Broken or expired URLs show the browser broken-image icon — no custom error handling, accepted for MVP.
- The 50-character counter uses `reflection.length` (raw character count), not trimmed. A user who pads with spaces would pass client-side but Firestore rules use `.size()` on the raw string — consistent behavior.

## Success Criteria (Summary)

- Publish button is disabled until both a non-empty photo URL and a ≥50-character reflection are present (client-side gate)
- Firestore rejects a direct `addDoc` call with `reflection.size() < 50` — confirmed via browser DevTools test
- Submitted photo appears in the feed within ~1 second, without any page refresh or navigation (real-time confirmation)
