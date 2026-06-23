---
date: 2026-06-23T00:00:00+02:00
researcher: damiannelus
git_commit: 9a917154eedec0ae533375dc6554528efa6de6fe
branch: main
repository: photo-interest-group
topic: "PostHog integration — event taxonomy and instrumentation plan"
tags: [research, posthog, analytics, events, firebase, auth]
status: complete
last_updated: 2026-06-23
last_updated_by: damiannelus
---

# Research: PostHog Integration — Event Taxonomy and Instrumentation Plan

**Date**: 2026-06-23  
**Researcher**: damiannelus  
**Git Commit**: 9a917154eedec0ae533375dc6554528efa6de6fe  
**Branch**: main  
**Repository**: photo-interest-group

## Research Question

How to properly connect the existing Photo Interest Group application with PostHog by defining a comprehensive event taxonomy, identifying exact instrumentation points in the codebase, and establishing user identity.

## Summary

The app is a React Router v7 + Firebase static SPA with zero existing observability. All 8 roadmap slices (auth, challenges, submissions, follow-ups, comments) are shipped and working. PostHog JS is the right integration target. The setup requires:

1. `PostHogProvider` added to `app/root.tsx` alongside the existing `AuthProvider`
2. `posthog.identify()` wired into the auth context so identity is set whenever Firebase resolves a user
3. `posthog.capture()` calls at 12 distinct user action sites across 5 files
4. `posthog.reset()` on sign-out (two call sites)

No prior analytics exist — this is a blank slate.

---

## Detailed Findings

### App Structure Overview

| Layer | Details |
|---|---|
| Framework | React Router v7 (static SPA, `ssr: false`) |
| Auth | Firebase Auth — Google Sign-In via popup |
| Database | Firestore — `challenges`, `submissions`, `submissions/{id}/comments` |
| Deployment | Firebase Hosting |
| Analytics today | None |

### Route Map

| Route | File | Auth Required |
|---|---|---|
| `/why` | `app/routes/why.tsx` | No |
| `/login` | `app/routes/login.tsx` | No |
| `/` | `app/routes/challenges.tsx` | Yes (protected layout) |
| `/challenges/new` | `app/routes/challenges.new.tsx` | Yes (protected layout) |
| (layout) | `app/routes/_protected.tsx` | Yes — wraps `/` and `/challenges/new` |

### User Identity

PostHog identity mapping:

| PostHog field | Firebase source | Code location |
|---|---|---|
| `distinct_id` | `user.uid` | `app/context/auth.tsx:13` — auth state |
| `email` | `user.email` | Used everywhere in the app |
| `displayName` | not set in app | `user.displayName` exists on Firebase User but unused |

`posthog.identify()` should be called inside `AuthProvider` in `app/context/auth.tsx` at the `onAuthStateChanged` callback (line 17). When `user` is non-null: identify. When `user` is null (sign-out): `posthog.reset()`.

### Firestore Write Shape (event property source)

| Collection | Write site | Fields |
|---|---|---|
| `challenges` | `app/routes/challenges.new.tsx:27` | `title`, `description`, `createdBy`, `createdAt`, `status` |
| `submissions` (root) | `app/components/ChallengeCard.tsx:59` | `challengeId`, `photoUrl`, `reflection`, `authorUid`, `authorEmail`, `createdAt`, `parent_submission_id: null` |
| `submissions` (follow-up) | `app/components/SubmissionCard.tsx:108` | `challengeId`, `photoUrl`, `reflection`, `authorUid`, `authorEmail`, `createdAt`, `parent_submission_id: <id>` |
| `submissions` (edit) | `app/components/SubmissionCard.tsx:150` | `reflection` |
| `submissions/{id}/comments` | `app/components/SubmissionCard.tsx:66` | `text`, `authorUid`, `authorEmail`, `createdAt` |

### Whitelist Architecture

The whitelist is an env-var array (`VITE_ALLOWED_EMAILS`), parsed in `app/lib/allowedEmails.ts`. Rejection happens in two places:
- `app/routes/login.tsx:39-41` — immediately after popup sign-in
- `app/routes/_protected.tsx:18` — layout guard

Both paths render `<RejectionScreen />` or call `signOut()`.

---

## Event Taxonomy

12 events cover every meaningful user action. Naming convention: `noun_verb` (past tense). Properties: snake_case, no PII beyond `email` (already tied to the PostHog identity, so redundant in properties — omit it).

### Auth Events

#### `user_signed_in`
- **Trigger**: Google OAuth popup succeeds AND email passes whitelist check
- **Site**: `app/routes/login.tsx` — inside `handleSignIn()`, after `allowedEmails.includes(email)` check passes (line 39)
- **Properties**: *(none — user identity already set via `posthog.identify()`)*

#### `whitelist_rejected`
- **Trigger**: Google OAuth succeeds but email is NOT in the whitelist
- **Site**: `app/routes/login.tsx` — else branch at line 40, before `signOut(auth)`
- **Properties**:
  ```ts
  { email: result.user.email }  // only event where email is a property — useful for admin triage
  ```

#### `user_signed_out`
- **Trigger**: User clicks "Sign out" in sidebar OR "Sign Out" on rejection screen
- **Sites**:
  - `app/components/Sidebar.tsx:74` — `handleSignOut()`
  - `app/components/RejectionScreen.tsx:12` — `handleSignOut()`
- **Properties**: *(none — call `posthog.reset()` here, not `posthog.capture()`)*
- **Note**: `posthog.reset()` already dissociates the identity, no separate capture needed unless you want a named event in the event stream. Capturing it explicitly is optional but useful for session analysis.

---

### Challenge Events

#### `challenge_created`
- **Trigger**: User submits the "New Challenge" form successfully (Firestore write succeeds)
- **Site**: `app/routes/challenges.new.tsx:34` — after `navigate("/")` in `handleSubmit()`
- **Properties**:
  ```ts
  {
    has_description: description.trim().length > 0,
  }
  ```
  Do not capture the title — content is not analytics data.

---

### Submission Events

#### `submission_form_opened`
- **Trigger**: User clicks "Submit Photo" to open the inline submission form on a challenge card
- **Site**: `app/components/ChallengeCard.tsx:90` — in the `setFormOpen` toggle, when opening (not closing)
- **Properties**:
  ```ts
  {
    challenge_id: challenge.id,
  }
  ```

#### `submission_published`
- **Trigger**: User publishes a root submission (photo + reflection) successfully
- **Site**: `app/components/ChallengeCard.tsx:69` — after Firestore `addDoc` resolves in `handleSubmit()`
- **Properties**:
  ```ts
  {
    challenge_id: challengeId,
    reflection_length: reflection.trim().length,
  }
  ```

#### `submission_deleted`
- **Trigger**: User confirms and successfully deletes their own submission
- **Site**: `app/components/SubmissionCard.tsx:136` — after `deleteDoc` resolves in `handleDeleteSubmission()`
- **Properties**:
  ```ts
  {
    challenge_id: submission.challengeId,
  }
  ```

#### `reflection_edited`
- **Trigger**: User saves an edited reflection on their own submission
- **Site**: `app/components/SubmissionCard.tsx:154` — after `updateDoc` resolves in `handleEditReflection()`
- **Properties**:
  ```ts
  {
    new_reflection_length: editReflection.trim().length,
  }
  ```

---

### Follow-Up Events

#### `follow_up_form_opened`
- **Trigger**: User clicks "Follow-Up" button on a submission to open the follow-up form
- **Site**: `app/components/SubmissionCard.tsx:203` — in the `setFollowUpOpen` toggle, when opening (not closing)
- **Properties**:
  ```ts
  {
    parent_submission_id: submission.id,
    challenge_id: submission.challengeId,
  }
  ```

#### `follow_up_published`
- **Trigger**: User publishes a follow-up submission successfully
- **Site**: `app/components/SubmissionCard.tsx:118` — after `addDoc` resolves in `handleFollowUp()`
- **Properties**:
  ```ts
  {
    challenge_id: submission.challengeId,
    parent_submission_id: submission.id,
    reflection_length: fuReflection.trim().length,
  }
  ```

---

### Comment Events

#### `comment_posted`
- **Trigger**: User posts a text comment on a submission successfully
- **Site**: `app/components/SubmissionCard.tsx:73` — after `addDoc` resolves in `handlePost()`
- **Properties**:
  ```ts
  {
    submission_id: submission.id,
    text_length: commentText.trim().length,
  }
  ```

#### `comment_deleted`
- **Trigger**: User deletes their own comment successfully
- **Site**: `app/components/SubmissionCard.tsx:86` — after `deleteDoc` resolves in `handleDeleteComment()`
- **Properties**:
  ```ts
  {
    submission_id: submission.id,
  }
  ```

---

## Code References

| File | Line(s) | Purpose |
|---|---|---|
| `app/root.tsx` | 50–55 | Add `PostHogProvider` here (alongside `AuthProvider`) |
| `app/context/auth.tsx` | 17 | `onAuthStateChanged` callback — add `posthog.identify()` / `posthog.reset()` |
| `app/routes/login.tsx` | 37–41 | `user_signed_in` and `whitelist_rejected` capture sites |
| `app/components/Sidebar.tsx` | 73–76 | `user_signed_out` / `posthog.reset()` site |
| `app/components/RejectionScreen.tsx` | 10–13 | Second `posthog.reset()` site |
| `app/routes/challenges.new.tsx` | 27–34 | `challenge_created` capture site |
| `app/components/ChallengeCard.tsx` | 59–71, 88–98 | `submission_published`, `submission_form_opened` |
| `app/components/SubmissionCard.tsx` | 60–81, 83–91, 93–128, 130–142, 144–162, 200–208 | All remaining events |

---

## Architecture Insights

### Integration pattern — PostHogProvider placement

`app/root.tsx` already wraps the app with `<AuthProvider>`. The natural placement is:

```tsx
// app/root.tsx
<PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={...}>
  <AuthProvider>
    <Outlet />
  </AuthProvider>
</PostHogProvider>
```

PostHog outside AuthProvider means `posthog` is available everywhere, including inside the auth context where `identify()` will be called.

### Identity wiring — auth context

`app/context/auth.tsx` is the single place where Firebase resolves the current user. Adding identify/reset here means every downstream component gets correct identity automatically — no need to re-identify in individual route components.

```tsx
// Inside onAuthStateChanged callback at app/context/auth.tsx:17
onAuthStateChanged(auth, (firebaseUser) => {
  setUser(firebaseUser);
  if (firebaseUser) {
    posthog.identify(firebaseUser.uid, { email: firebaseUser.email });
  } else {
    posthog.reset();
  }
});
```

### Toggle events — open-only capture

Several state toggles (submission form, follow-up form, comments) use `v => !v` — they open AND close. Capture only on `open` (when current value is false), not on close, to avoid double-counting. The pattern:

```tsx
onClick={() => {
  const opening = !formOpen;
  setFormOpen(opening);
  if (opening) posthog.capture('submission_form_opened', { challenge_id: challenge.id });
}}
```

### Properties to avoid

- Full reflection text, comment text, or challenge title — content, not analytics data
- `authorEmail` / `authorUid` on events — already on the PostHog person via `identify()`
- `photoUrl` — no analytical value

### Autocapture

Setting `autocapture: true` in `PostHogConfig` will capture clicks, inputs, and form submits automatically. Given this app's small size and clear event taxonomy, autocapture is useful as a safety net but should NOT replace explicit `capture()` calls — the explicit calls carry structured properties that autocapture cannot.

`capture_pageview: 'history_change'` is required for React Router SPA navigation to record page views correctly.

---

## Historical Context (from prior changes)

No prior PostHog or analytics work exists in `context/archive/` or `context/changes/`. This is a greenfield instrumentation effort.

The lessons file (`context/foundation/lessons.md`) contains one rule: trim-consistent gate and display. This is relevant because some event properties use `.trim().length` — the codebase consistently uses `.trim().length` for the 50-char gate logic (not `.length`), so event properties like `reflection_length` should also use `.trim().length` to stay consistent with what the gate actually validates.

---

## Open Questions

1. **PostHog project region** — EU (`eu.i.posthog.com`) or US (`app.posthog.com`)? Affects `api_host` config. For a Polish user group, EU is the likely preference (GDPR proximity).
2. **Session recording** — `disable_session_recording: false` is the PostHog default. For a private, closed group this may be acceptable. Worth a conscious yes/no decision before shipping.
3. **Cookie consent** — The app has no cookie banner. PostHog sets a cookie by default. For a private members-only tool this is low risk, but worth noting.
4. **Env var name** — PostHog key should go into `.env.local` as `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST`. Confirm these names are added to `.env.example` and not committed to git.
