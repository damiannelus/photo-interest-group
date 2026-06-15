---
project: "Photo Interest Group"
context_type: greenfield
created: 2026-06-14
updated: 2026-06-14  # finalized
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "core pain framing"
      decision: "Reflection-as-gatekeeper is the primary value — the app exists because other platforms make self-reflection optional; this one makes it non-skippable"
    - topic: "primary persona scope"
      decision: "Fixed, known circle of ~5–15 photographer friends; membership managed via a curated email whitelist; no public onboarding"
    - topic: "auth model"
      decision: "Google Sign-In only for MVP; whitelist managed out-of-band; invite links deferred to nice-to-have"
    - topic: "role model"
      decision: "Flat — all members have identical permissions; no in-app admin role; whitelist managed out-of-band"
    - topic: "photo submission method"
      decision: "URL-based (paste a link to a hosted image) — avoids Firebase Storage complexity for 1-week MVP; file upload deferred"
    - topic: "reflection minimum"
      decision: "50 characters minimum enforced client-side and server-side; one-character gate was too weak"
    - topic: "invite links"
      decision: "Demoted to nice-to-have (FR-003); whitelist managed manually for MVP"
  frs_drafted: 13
  quality_check_status: accepted
---

## Vision & Problem Statement

Photo-sharing platforms optimize for posting speed and reach, not for learning or growth. A photographer in a close-knit group can upload and share immediately without pausing to think about what they were trying to achieve, what worked, or what they'd do differently. That missing pause is the cost: photos get reactions but no reflective dialogue; skill development stagnates; conversations about craft never start because they're never seeded.

The insight: a small, trusted group of photographers will engage more deeply with each other's work when the act of sharing itself forces the sharer to articulate their own intent first. Reflection is not a feature added on top of sharing — it is the gatekeeper. Without a written self-reflection, the photo does not publish. This constraint transforms the tool from a gallery into a structured learning space.

## User & Persona

**Primary persona:** A hobbyist or semi-serious photographer who is part of a specific, pre-existing circle of friends with a shared interest in photography. They shoot regularly (any gear, any style), they want feedback that goes beyond emoji reactions, and they value growth over audience size. They're comfortable with web apps. The moment they reach for this product: they've finished editing a photo and want to share it with the group — but they use this tool instead of a chat because it forces them to think first.

**Group composition:** ~5–15 people, all known to each other. There is no viral growth loop — new members are added manually by whoever manages the whitelist.

---

## Access Control

**Auth:** Google Sign-In (OAuth). Any Google account can attempt login; only accounts whose email appears on the server-side whitelist may proceed to the app.

**Whitelist management (MVP):** Managed out-of-band (e.g., Firestore console or a config file). No in-app UI for adding members.

**Invite mechanism (nice-to-have, post-MVP):** Any existing member will eventually be able to generate a single-use invite link to add a new member. Out of scope for the 1-week MVP.

**Role model:** Flat. Every member can: post photos with reflections, create challenges, comment on any submission, and initiate follow-up submissions. There is no in-app admin role.

**Unauthenticated access:** None. Every route requires an authenticated, whitelisted session. An unrecognized email sees a rejection screen, not a feed.

---

## Success Criteria

**MVP flow (7 steps):**
1. User visits app → prompted to sign in with Google
2. Sign-in succeeds → user lands on the main feed (challenges + submissions)
3. User clicks "Submit Photo" on a challenge → submission form opens
4. User fills in photo + reflection note → "Publish" button becomes enabled
5. User publishes → submission appears in the feed
6. Another member clicks "Follow-Up" on a submission → form opens with parent context pre-filled
7. Members leave comments on any submission

**Timeline:** 1 week target, after-hours only, no hard deadline.

### Primary
- The 7-step MVP flow completes end-to-end for a real member: auth → feed → submit (with reflection gate) → follow-up → comment.
- A photo cannot be published without a non-empty reflection field — no UI path or direct API call bypasses this.

### Secondary
- Members can browse past challenges and their full submission history, not just the current live feed.

### Guardrails
- Reflection field is always enforced: no submission reaches the database without a non-empty `reflection` value.
- Every follow-up submission correctly stores its `parent_submission_id` — broken parent links corrupt the chain-of-inspiration model and are treated as critical bugs, not UI issues.

---

## User Stories

### US-01: Member submits a photo with reflection

- **Given** a signed-in, whitelisted member viewing a challenge
- **When** they open the submission form, paste a URL to a hosted photo, write a reflection, and click "Publish"
- **Then** the submission appears in the challenge feed, visible to all members

#### Acceptance Criteria
- The "Publish" button is disabled until both a valid photo URL and a reflection of at least 50 characters are present
- After publishing, the submission is immediately visible in the feed without a page refresh
- The submission records: photo URL, reflection text, user ID, challenge ID, timestamp

---

## Functional Requirements

### Authentication & Access
- FR-001: A visitor can sign in using their Google account. Priority: must-have
  > Socrates: Counter-argument considered: none. Google OAuth is the right call for this group.
- FR-002: A signed-in user whose email is not on the whitelist sees a rejection screen and cannot access the app. Priority: must-have
  > Socrates: Counter-argument considered: none. The rejection screen is the correct UX.
- FR-003: An existing member can generate a single-use invite link to add a new member. Priority: **nice-to-have** *(downgraded from must-have)*.
  > Socrates: Counter-argument accepted: "This is complex for a 1-week MVP — manually adding emails to Firestore is sufficient for now." Resolution: demoted to nice-to-have; whitelist managed out-of-band for MVP.

### Challenges
- FR-004: A member can view a list of active challenges with their descriptions. Priority: must-have
  > Socrates: Counter-argument considered: none.
- FR-005: A member can create a new challenge with a title and description. Priority: must-have
  > Socrates: Counter-argument considered: none.

### Submissions
- FR-006: A member can submit a photo to a challenge by **pasting a URL** to a hosted image. Priority: must-have *(revised from file upload)*.
  > Socrates: Counter-argument accepted: "URL-based submission avoids Firebase Storage complexity for a 1-week MVP." Resolution: revised to URL-based. Trade-off: links can break over time.
- FR-007: A member cannot publish a submission unless the reflection field contains **at least 50 characters**. Priority: must-have *(raised from 1-character minimum)*.
  > Socrates: Counter-argument accepted: "One character is too weak." Resolution: 50-character minimum enforced client-side and server-side. Rationale: ~8–10 words — enough for a real sentence without being punishing.
- FR-008: A member can view all submissions for a challenge in the feed. Priority: must-have
  > Socrates: Counter-argument considered: none.

### Follow-Up
- FR-009: A member can initiate a follow-up submission from an existing submission, with the parent submission's context pre-filled. Priority: must-have
  > Socrates: Counter-argument considered: none. Pre-filled context is the right UX.
- FR-010: A follow-up submission records the parent submission's ID, preserving the chain relationship. Priority: must-have
  > Socrates: Counter-argument considered: none. Parent ID is a data integrity requirement.

### Comments
- FR-011: A member can post a text comment on any submission. Priority: must-have
  > Socrates: Counter-argument considered: none. Text comments are the right lightweight feedback mechanism.
- FR-012: A member can view all comments on a submission. Priority: must-have
  > Socrates: Counter-argument considered: none.

### Browse / History
- FR-013: A member can browse past challenges and their full submission history. Priority: nice-to-have
  > Socrates: Counter-argument considered: none. Nice-to-have is the right priority; the main feed serves the primary need.

---

## Business Logic

**A photo submission is only published when the submitter has articulated — in at least 50 characters — what they were attempting with the photo.**

The rule applies unconditionally: no path through the UI or API bypasses it. The input is the submitter's typed reflection text (free-form, no structured prompt). The output is a published submission visible to all members. The user encounters it as a disabled "Publish" button that becomes active only once the 50-character threshold is crossed.

A secondary mechanic supports, but does not replace, the primary rule: any published submission can be used as the starting point for a follow-up submission. The follow-up inherits contextual information from its parent (challenge, parent photo reference) and requires its own reflection text, producing a visible chain of creative responses. The chain relationship is defined by `parent_submission_id` stored on the follow-up submission; the rule applies identically to all submissions regardless of their position in a chain.

---

## Non-Functional Requirements

- No submission, comment, challenge, or user data is accessible to any unauthenticated user or any authenticated user whose email is not on the whitelist — not via the UI, and not via a direct API or Firestore URL.
- The product is usable on the latest two major versions of Chrome, Safari, and Firefox without layout breakage or functional degradation.

---

## Non-Goals

- **No native mobile app:** MVP is web-only. Members access via a browser on any device. A native iOS/Android app is not in scope.
- **No likes, reactions, or voting:** Feedback is text-only (comments). No engagement counters, hearts, stars, or voting on submissions. The goal is substantive dialogue, not metric-driven engagement.
- **No public-facing content:** Nothing in the app is ever shareable outside the group. There is no public permalink, embed code, or 'share to social' mode. All content is private to whitelisted members.

## Product Framing

- **Product type:** web-app
- **Target scale:** small (5–15 known members; no growth expectation for MVP)
- **Timeline:** 1 week, after-hours only, no hard deadline

---

## Open Questions

No open questions — all elements present and resolved.

## Quality cross-check

Ran 2026-06-14. Status: **accepted** (no gaps).
All 6 greenfield elements present: Access Control, Business Logic, Project artifacts, Timeline-cost acknowledgment, Non-Goals, and Preserved behavior (n/a — greenfield).
Two internal inconsistencies corrected before final write: (1) Access Control updated to reflect invite-link demotion; (2) US-01 updated to URL-based photo submission.
