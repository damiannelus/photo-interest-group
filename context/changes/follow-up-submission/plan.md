# Follow-Up Submission Implementation Plan

## Overview

Implement FR-009 and FR-010: any member can click "Follow-Up" on any submission to open an inline form with parent context pre-shown, write their own photo + reflection, and publish a new submission that records `parent_submission_id`. The feed then renders these chains indented under their parent with a visual left-border connector. Also fixes a pre-existing trim inconsistency bug in the root submission form (lessons.md rule).

## Current State Analysis

`app/routes/challenges.tsx` contains three components:
- `ChallengeFeed` — top-level page, renders `ChallengeCard` per challenge
- `ChallengeCard` — manages the submission form (root submissions) and a flat `ul` of `SubmissionCard`
- `SubmissionCard` — shows one submission's photo + reflection + inline comment form

The `Submission` type (`app/types/submission.ts:11`) already declares `parent_submission_id: string | null`. Root submissions written today do not include this field in their Firestore payload (it would be `undefined` on fetch, not `null`). The tree-build logic must treat both `undefined` and `null` as root markers via `?? null`.

The reflection counter in `ChallengeCard` (line 376–382) uses raw `reflection.length` for both the color threshold and the displayed count, while `canSubmit` gates on `reflection.trim().length >= 50`. This violates the lessons.md trim-consistency rule and must be corrected.

### Key Discoveries

- `app/routes/challenges.tsx:246–249` — `canSubmit` in ChallengeCard correctly uses `.trim().length` for the gate; the counter on lines 376–382 incorrectly uses raw `.length`
- `app/routes/challenges.tsx:269–281` — root submission `addDoc` payload lacks `parent_submission_id`; adding `: null` makes all future documents consistent with the type
- `app/routes/challenges.tsx:38` — comment gate (`canPost`) already uses `.trim().length` correctly — follow the same pattern for the follow-up form
- `app/types/submission.ts:11` — `parent_submission_id: string | null` already typed; no schema change needed
- No modal infrastructure exists in the codebase; inline expansion (same pattern as the comment section) is the natural fit

## Desired End State

A "Follow-Up" button appears on every `SubmissionCard` alongside the "Comments (N)" toggle. Clicking it opens an inline form directly below the parent card showing a compact read-only context block (parent photo thumbnail + author email + first ~80 chars of reflection) followed by a new photo URL input and reflection textarea with a trim-consistent 50-character gate. Submitting writes a new Firestore document with `parent_submission_id` set to the parent's ID and `challengeId` inherited from the parent. In the feed, follow-ups render indented under their parent (left-border connector, `ml-4 pl-4 border-l-2`) and are visible by default. Chains of arbitrary depth render correctly, with visual indentation capped at 3 levels to prevent narrow cards on small screens.

### Key Discoveries:

- The existing `SubmissionCard` comment form is the exact UX pattern to mirror for the follow-up form (toggle button → opens inline section → clears on success)
- `ChallengeCard` currently renders submissions as a flat `<ul>` — this must be replaced with a tree-building render that groups submissions by `parent_submission_id` and recurses
- Existing Firestore documents without `parent_submission_id` must be treated as roots during tree-build (`s.parent_submission_id ?? null`)
- Visual indent cap: depth ≥ 3 renders at the same indentation as depth 3 (the `depth` prop passed to the recursive component is capped at 3)

## What We're NOT Doing

- No new routes or pages — everything stays inside `challenges.tsx`
- No extracted shared submission form component — the follow-up form and root form remain co-located in their respective components (no premature abstraction at MVP scale)
- No Firestore security rule changes — the follow-up write uses the same `submissions` collection path; existing rules apply
- No per-submission "can't follow up" restrictions — any member can follow up on any submission including their own
- No collapse/expand toggle for chains — chains render expanded by default; no "N follow-ups" toggle
- No invite or whitelist UI — out of scope per PRD

## Implementation Approach

Three sequential phases in a single file (`app/routes/challenges.tsx`). Each phase is independently verifiable before moving on.

Phase 1 corrects the pre-existing bug and primes root writes for consistency. Phase 2 adds the follow-up button and form to `SubmissionCard`. Phase 3 replaces the flat list render in `ChallengeCard` with a recursive tree renderer.

The tree-build is client-side: the existing `onSnapshot` query fetches all submissions for a challenge in `createdAt desc` order. Phase 3 groups them into a `Map<string | null, Submission[]>` keyed by `parent_submission_id ?? null`, preserving descending order for root groups and reversing to ascending for child groups (to show the chain chronologically). A new `SubmissionList` function component renders the tree recursively.

## Critical Implementation Details

**Existing documents without `parent_submission_id`**: Firestore returns `undefined` for absent fields on deserialized objects. The tree-build key expression must be `s.parent_submission_id ?? null` (not `=== null`) so these documents sort into the root group.

**Indent depth cap**: Pass `depth={Math.min(depth + 1, 3)}` when recursing so indentation stops growing past level 3, preventing layout breakage on narrow screens. The recursion itself is unlimited — only the visual class changes.

---

## Phase 1: Trim Fix & Root Parent ID

### Overview

Corrects the reflection counter in `ChallengeCard` (the lessons.md trim-consistency bug) and adds `parent_submission_id: null` to the root submission write so all Firestore documents are consistent with the `Submission` type from day one.

### Changes Required:

#### 1. ChallengeCard reflection counter

**File**: `app/routes/challenges.tsx`

**Intent**: Fix the trim inconsistency so the counter color and displayed count use `.trim().length`, matching the gate in `canSubmit`. This removes the case where a user types whitespace, sees a green "50 / 50 characters" counter, and finds the Publish button still disabled.

**Contract**: Both the `className` condition and the `{...}` interpolation in the reflection `<p>` element (currently lines 376–382) must use `reflection.trim().length` instead of `reflection.length`.

#### 2. Root submission write

**File**: `app/routes/challenges.tsx`

**Intent**: Explicitly set `parent_submission_id: null` in the `addDoc` payload of `handleSubmit` inside `ChallengeCard`, so root submissions are distinguishable from follow-ups without relying on field absence.

**Contract**: Add `parent_submission_id: null` to the object passed to `addDoc(collection(db, "submissions"), {...})` (currently lines 269–280).

### Success Criteria:

#### Automated Verification:

- TypeScript type-check passes: `npm run typecheck`
- No lint errors: `npm run lint`

#### Manual Verification:

- In the root submission form, type 10 spaces in the reflection field — the counter reads "0 / 50 characters" (not "10 / 50") and stays gray; Publish stays disabled
- Submit a root submission → inspect the Firestore document in Firebase Console → `parent_submission_id` field is present with value `null`

**Implementation Note**: Pause after Phase 1 manual verification passes before proceeding.

---

## Phase 2: Follow-Up Button and Form in SubmissionCard

### Overview

Adds a "Follow-Up" button to each `SubmissionCard` that opens an inline form with compact parent context, photo URL input, and reflection textarea. On submit, writes a new Firestore submission with `parent_submission_id` set to the parent's ID.

### Changes Required:

#### 1. Follow-up state in SubmissionCard

**File**: `app/routes/challenges.tsx`

**Intent**: Add the state variables needed to control the follow-up form: open/closed toggle, field values, submission status, and error display.

**Contract**: Add to the existing `useState` block in `SubmissionCard`:
- `followUpOpen: boolean` (default `false`)
- `fuPhotoUrl: string` (default `""`)
- `fuReflection: string` (default `""`)
- `fuSubmitting: boolean` (default `false`)
- `fuError: string | null` (default `null`)

Derived gate: `canFollowUp = fuPhotoUrl.trim().length > 0 && fuReflection.trim().length >= 50 && !fuSubmitting`

#### 2. Follow-Up button

**File**: `app/routes/challenges.tsx`

**Intent**: Add a "Follow-Up" toggle button alongside the "Comments (N)" button. Opening the follow-up form should close the comment section (mutual exclusion keeps the card compact) and vice versa.

**Contract**: Add a `<button>` with text "Follow-Up" / "Cancel Follow-Up" beside the existing Comments toggle. When setting `followUpOpen` to `true`, also call `setCommentOpen(false)`. Symmetrically, when the Comments toggle sets `commentOpen` to `true`, also call `setFollowUpOpen(false)`.

#### 3. Compact parent context block

**File**: `app/routes/challenges.tsx`

**Intent**: When `followUpOpen` is true, show a read-only summary of the parent submission above the form inputs so the submitter can see what they're responding to.

**Contract**: Renders when `followUpOpen` is true. Contains: the parent's `photoUrl` as a small thumbnail (`w-10 h-10 object-cover rounded`), `authorEmail` in a small label, and `reflection` truncated to 80 characters with an ellipsis if longer. Style: `bg-gray-50 dark:bg-gray-800 rounded p-3 flex gap-3 mb-4`. Marked visually distinct from the editable fields (label: "Responding to:").

#### 4. Follow-up form fields and submission

**File**: `app/routes/challenges.tsx`

**Intent**: Render the photo URL input (with preview and HTTPS validation), reflection textarea with trim-consistent 50-character gate, error display, and Publish/Cancel buttons — identical in structure and validation to the existing root submission form in `ChallengeCard`.

**Contract**:
- Photo URL input: same HTTPS-only validation as `ChallengeCard.handleSubmit` (lines 256–263) — reject non-HTTPS or invalid URLs with `fuError`; show image preview when `fuPhotoUrl.trim().length > 0`
- Reflection counter: `fuReflection.trim().length` for both color threshold and displayed count (trim-consistent per lessons.md)
- `handleFollowUp`: on valid submit, call `addDoc(collection(db, "submissions"), { challengeId: submission.challengeId, photoUrl: fuPhotoUrl.trim(), reflection: fuReflection.trim(), authorUid: user.uid, authorEmail: user.email ?? "", createdAt: serverTimestamp(), parent_submission_id: submission.id })`; on success clear all `fu*` state and set `followUpOpen` to `false`; on error set `fuError`
- Publish button disabled when `!canFollowUp`; Cancel button sets `followUpOpen` to `false` and clears all `fu*` state

### Success Criteria:

#### Automated Verification:

- TypeScript type-check passes: `npm run typecheck`
- No lint errors: `npm run lint`

#### Manual Verification:

- Click "Follow-Up" on any submission → form opens; "Comments (N)" section closes if it was open
- Parent context block shows the correct thumbnail, author email, and truncated reflection
- Typing whitespace-only into the reflection field: counter shows "0 / 50", button stays disabled
- Submit a valid photo URL (HTTPS) and 50+ char reflection → Firestore document created with correct `parent_submission_id`, `challengeId`, `authorUid`, `authorEmail`
- Submit with an HTTP URL (not HTTPS) → error message appears, no Firestore write
- After successful publish: form closes, fields clear

**Implementation Note**: Pause after Phase 2 manual verification passes before proceeding.

---

## Phase 3: Chain Tree Rendering

### Overview

Replaces the flat `submissions.map(...)` render in `ChallengeCard` with a recursive `SubmissionList` component that builds a `parent_submission_id` tree client-side and renders follow-ups indented under their parent with a left-border visual connector.

### Changes Required:

#### 1. `buildSubmissionTree` helper

**File**: `app/routes/challenges.tsx`

**Intent**: Group a flat list of submissions into a `Map<string | null, Submission[]>` keyed by `parent_submission_id ?? null`, with root groups ordered descending (newest first) and child groups ordered ascending (chronological chain). Declare this as a module-level function outside any component.

**Contract**: Signature: `function buildSubmissionTree(submissions: Submission[]): Map<string | null, Submission[]>`. Iterates once over `submissions` to populate the map using `s.parent_submission_id ?? null` as the key. After building, sorts each non-null-keyed group ascending by `createdAt` (use `.toMillis()` on the Firestore `Timestamp`, defaulting to `0` if absent). The null-keyed group retains its original order (which the query already provides as descending).

#### 2. `SubmissionList` component

**File**: `app/routes/challenges.tsx`

**Intent**: Recursive component that renders a group of submissions for a given `parentId` with optional indentation, then recurses into each item's follow-ups.

**Contract**: Props: `{ parentId: string | null; byParent: Map<string | null, Submission[]>; depth: number }`. Renders `null` when the group is empty. Applies indent styles when `depth > 0`: `className="ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800"`. Recurses with `depth={Math.min(depth + 1, 3)}` — caps visual indentation at 3 levels while rendering continues at unlimited depth.

#### 3. Replace flat render in ChallengeCard

**File**: `app/routes/challenges.tsx`

**Intent**: Swap the flat `<ul>` and `submissions.map(...)` block in `ChallengeCard`'s submissions section for a `SubmissionList` render that starts at the root group.

**Contract**: Remove the `<ul>{submissions.map(sub => <SubmissionCard ... />)}</ul>` block (currently lines 438–444). Replace with `<SubmissionList parentId={null} byParent={buildSubmissionTree(submissions)} depth={0} />`. The `submissions` state variable and `onSnapshot` wiring remain unchanged.

### Success Criteria:

#### Automated Verification:

- TypeScript type-check passes: `npm run typecheck`
- No lint errors: `npm run lint`

#### Manual Verification:

- All root submissions (no parent) still appear in the feed in descending order
- A follow-up submission appears visually indented under its parent with the left-border connector visible
- A follow-up of a follow-up (depth 2) renders indented under its own parent
- Submissions with depth 4+ render at the same visual indentation as depth 3 (no further rightward shift)
- No submissions are lost — count of visible submissions matches total in Firestore
- Existing Firestore documents that pre-date this feature (no `parent_submission_id` field) render as root submissions, not dropped
- The feed renders correctly on a narrow viewport (375px width) — no card clips off-screen at any chain depth

**Implementation Note**: Pause after Phase 3 manual verification passes before marking this change complete.

---

## Testing Strategy

### Manual Testing Steps:

1. As member A: submit a root photo to a challenge. Confirm `parent_submission_id: null` in Firestore.
2. As member B: click "Follow-Up" on A's submission. Confirm parent context block shows A's photo, email, and reflection excerpt. Submit a follow-up. Confirm new Firestore doc has `parent_submission_id = A's submission ID` and correct `challengeId`.
3. As member A: click "Follow-Up" on B's follow-up. Submit. Confirm depth-2 chain renders correctly in the feed (indented twice under A's root).
4. Whitespace reflection test: type 60 spaces in the reflection field of the follow-up form → counter reads "0 / 50", button stays disabled.
5. HTTP URL test: paste an `http://` URL → error message appears, no submission written.
6. Existing data test: confirm any submissions written before this feature still appear as root submissions in the feed.
7. Root form whitespace test: type 60 spaces in the ChallengeCard reflection field → counter reads "0 / 50", button stays disabled. (Verifies Phase 1 fix.)

## References

- PRD: `context/foundation/prd.md` (FR-009, FR-010, business logic section)
- Lessons: `context/foundation/lessons.md` (trim-consistency rule)
- Source: `app/routes/challenges.tsx`
- Types: `app/types/submission.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Trim Fix & Root Parent ID

#### Automated

- [x] 1.1 TypeScript type-check passes: `npm run typecheck` — 0212e97
- [x] 1.2 No lint errors: `npm run lint` — 0212e97

#### Manual

- [x] 1.3 Whitespace in reflection field shows "0 / 50" and stays gray; Publish stays disabled — 0212e97
- [x] 1.4 Root submission Firestore document has `parent_submission_id: null` — 0212e97

### Phase 2: Follow-Up Button and Form in SubmissionCard

#### Automated

- [x] 2.1 TypeScript type-check passes: `npm run typecheck`
- [x] 2.2 No lint errors: `npm run lint`

#### Manual

- [x] 2.3 Follow-Up button opens inline form; comment section closes if open
- [x] 2.4 Parent context block shows correct thumbnail, author, and truncated reflection
- [x] 2.5 Whitespace-only reflection: counter "0 / 50", button disabled
- [x] 2.6 Valid follow-up submit creates Firestore doc with correct `parent_submission_id` and `challengeId`
- [x] 2.7 HTTP URL rejected with error message; no Firestore write
- [x] 2.8 After publish: form closes, fields clear

### Phase 3: Chain Tree Rendering

#### Automated

- [ ] 3.1 TypeScript type-check passes: `npm run typecheck`
- [ ] 3.2 No lint errors: `npm run lint`

#### Manual

- [ ] 3.3 Root submissions appear in feed in descending order
- [ ] 3.4 Follow-up appears indented under its parent with left-border connector
- [ ] 3.5 Depth-2 follow-up renders indented under its own parent
- [ ] 3.6 Depth 4+ renders at same visual indentation as depth 3
- [ ] 3.7 No submissions lost — visible count matches Firestore total
- [ ] 3.8 Pre-feature documents (no `parent_submission_id`) render as roots
- [ ] 3.9 Feed renders correctly at 375px viewport width
