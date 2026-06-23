# PostHog Integration Implementation Plan

## Overview

Install and configure PostHog JS (EU region) in the Photo Interest Group app to capture 12 named analytics events across the full member journey — auth, challenges, submissions, follow-ups, and comments. Includes a GDPR-compliant cookie consent bottom bar with hard opt-out (no events captured before consent).

## Current State Analysis

- Zero existing analytics or observability. Blank slate — no migration, no conflicts.
- React Router v7 static SPA (`ssr: false`), React 19, Tailwind CSS, TypeScript, Firebase Auth + Firestore.
- Auth is managed through `AuthProvider` in `app/context/auth.tsx`, wrapping the app from `app/root.tsx:52`.
- Protected routes live under the `_protected.tsx` layout, which renders `<Sidebar />` and guards by auth + whitelist.
- All 8 feature slices are complete and production-ready.

## Desired End State

PostHog (EU datacenter) captures 12 named events for every whitelisted member who has accepted the cookie consent banner. Members who decline see zero PostHog activity. Session recordings are enabled. A minimal fixed bottom bar handles consent on first use and never reappears once dismissed.

### Key Discoveries:

- User identity: `user.uid` → PostHog `distinct_id`; `user.email` → person property. Source: `app/context/auth.tsx:17`
- 12 event call sites span 6 files: `login.tsx`, `Sidebar.tsx`, `RejectionScreen.tsx`, `challenges.new.tsx`, `ChallengeCard.tsx`, `SubmissionCard.tsx`
- Toggle handlers at `ChallengeCard.tsx:90` and `SubmissionCard.tsx:203` use `v => !v` — the open events must fire on open only, not on close
- `posthog.capture('user_signed_out')` must precede `posthog.reset()` — reset clears identity; capturing after it produces an anonymous event
- `_protected.tsx` is the correct mount point for `<CookieConsent />` — it wraps all post-auth views where the app is actually used

## What We're NOT Doing

- No tracking of content: reflection text, comment text, challenge titles, photo URLs are never sent to PostHog
- No per-event `authorEmail`/`authorUid` properties — PostHog associates events to persons via `identify()` automatically
- No server-side event capture (all client-side via posthog-js)
- No PostHog feature flags or A/B testing
- No custom PostHog dashboard configuration (done in PostHog UI once data flows)
- No cookie policy detail page (minimal bar only; appropriate for a private ~15-person group)

## Implementation Approach

Four sequential phases: (1) install and configure PostHog with EU-region provider and consent-gating via the `loaded` callback; (2) wire `posthog.identify()`/`posthog.reset()` in the auth context so identity is set automatically on every auth state change; (3) build and mount the cookie consent bottom bar; (4) add `capture()` calls at all 12 event sites.

## Critical Implementation Details

**Consent gate in the `loaded` callback**: PostHog's `loaded: (ph) => void` option fires once on init. If `localStorage.getItem('ph_consent') !== 'accepted'`, call `ph.opt_out_capturing()` immediately — this is the gating mechanism that blocks all capture before consent. Without it, PostHog fires events as soon as the page loads.

**`capture` before `reset` at sign-out**: At both `Sidebar.tsx` and `RejectionScreen.tsx`, `posthog.capture('user_signed_out')` must be called BEFORE `posthog.reset()`. `reset()` clears the identity — capturing after it produces an anonymous event with no person association.

**Toggle events — open-only**: `ChallengeCard.tsx:90` and `SubmissionCard.tsx:203` toggle their forms with `setFormOpen(v => !v)`. Replace with a local `opening` variable so the capture fires only when the form transitions from closed to open.

**Auth context uses direct import, not the hook**: `app/context/auth.tsx` fires `identify()`/`reset()` inside a `useEffect` callback (not a React event handler). Import `posthog` directly from `posthog-js` here — it is the same singleton instance the provider manages. Reserve `usePostHog()` for the components that fire discrete user events (Phases 3 and 4).

---

## Phase 1: Install & Configure PostHog

### Overview

Add `posthog-js` to the project, configure env vars, and wrap the app with `PostHogProvider` using EU-region config, autocapture, session recording, and a `loaded` callback that opts out by default until consent is given.

### Changes Required:

#### 1. Install package

**File**: root (shell command)

**Intent**: Add `posthog-js` as a runtime dependency.

**Contract**: `npm install posthog-js` — adds to `dependencies` in `package.json` and `package-lock.json`.

#### 2. Environment variables

**Files**: `.env.local` (runtime, git-ignored), `.env.example` (committed template)

**Intent**: Store the PostHog project API key and EU host so they are available at runtime via `import.meta.env` and documented for contributors.

**Contract**: Add two entries to `.env.local`:
```
VITE_PUBLIC_POSTHOG_KEY=phc_<your-key-here>
VITE_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```
Add the same two keys with placeholder values to `.env.example` (creating it if absent). Confirm `.env.local` is listed in `.gitignore`.

#### 3. PostHogProvider in root.tsx

**File**: `app/root.tsx`

**Intent**: Wrap `<AuthProvider>` with `<PostHogProvider>` so PostHog is available throughout the component tree, including inside the auth context. The `loaded` callback ensures capturing is blocked until the user has accepted consent.

**Contract**: Import `PostHogProvider` and `PostHogConfig` from `posthog-js/react`. Define `posthogOptions` and wrap at line 52 (currently `<AuthProvider>`):

```typescript
const posthogOptions: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  autocapture: true,
  capture_pageview: 'history_change',
  capture_pageleave: true,
  disable_session_recording: false,
  loaded: (ph) => {
    if (typeof window !== 'undefined' && localStorage.getItem('ph_consent') !== 'accepted') {
      ph.opt_out_capturing();
    }
  },
};

// root layout:
<PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={posthogOptions}>
  <AuthProvider>
    ...
  </AuthProvider>
</PostHogProvider>
```

`capture_pageview: 'history_change'` is required for React Router SPA — without it, PostHog misses client-side navigations.

### Success Criteria:

#### Automated Verification:

- `npm run typecheck` passes with no PostHog-related errors
- `npm run build` completes without error
- `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` are present in `.env.example`

#### Manual Verification:

- Open the app; open DevTools → Network filtered to `eu.i.posthog.com`: no requests appear (consent not yet given; Phase 3 needed for full verification)
- Open DevTools → Application → Local Storage: no `ph_*` opt-in keys are set

**Implementation Note**: Full manual verification of the opt-out gate requires Phase 3 (consent banner). Proceed once automated checks pass.

---

## Phase 2: Identity Wiring

### Overview

Call `posthog.identify()` when Firebase resolves an authenticated user, and `posthog.reset()` when the user is null. This happens in the single `onAuthStateChanged` callback in the auth context, so every downstream component inherits correct identity automatically.

### Changes Required:

#### 1. Identify/reset in AuthProvider

**File**: `app/context/auth.tsx`

**Intent**: Tie PostHog identity to Firebase auth state. When a user is present: identify with `uid` as distinct ID and `email` as a person property. When null (sign-out or token expiry): reset PostHog to dissociate the identity.

**Contract**: Add `import posthog from 'posthog-js'` at the top of the file. Inside the existing `onAuthStateChanged` callback (line 17), after `setUser(firebaseUser)`:

```typescript
if (firebaseUser) {
  posthog.identify(firebaseUser.uid, { email: firebaseUser.email ?? undefined });
} else {
  posthog.reset();
}
```

No new state, no additional effects, no change to the existing subscription structure.

### Success Criteria:

#### Automated Verification:

- `npm run typecheck` passes

#### Manual Verification:

- Accept cookie consent (Phase 3 required), then sign in: a person with the correct `uid` (distinct_id) and `email` appears in PostHog → People within a few seconds
- Sign out: no further events are attributed to that person until the next sign-in

---

## Phase 3: Cookie Consent Component

### Overview

Build a minimal fixed bottom-bar cookie consent component. On first visit it prompts the member to accept or decline analytics. The choice is persisted to `localStorage` under the `ph_consent` key. Accepting calls `posthog.opt_in_capturing()`; declining calls `posthog.opt_out_capturing()`. Render it in the protected layout so every authenticated, whitelisted member sees it on first access.

### Changes Required:

#### 1. CookieConsent component

**File**: `app/components/CookieConsent.tsx` (new file)

**Intent**: Render a fixed bottom bar that shows once per member (when `ph_consent` is absent from localStorage) and disappears permanently after accept or decline. Handles the PostHog opt-in/opt-out calls and persists the decision.

**Contract**:
- Use `usePostHog()` hook from `posthog-js/react`
- Initialize state from `localStorage.getItem('ph_consent')` — returns `'accepted'`, `'declined'`, or `null`
- Render nothing when state is non-null (choice already made)
- Accept handler: `posthog?.opt_in_capturing()`, set `localStorage.setItem('ph_consent', 'accepted')`, update state
- Decline handler: `posthog?.opt_out_capturing()`, set `localStorage.setItem('ph_consent', 'declined')`, update state
- Styling: `fixed bottom-0 left-0 right-0` full-width bar with a brief message and two buttons. Match the app's existing gray/white palette (reference `Sidebar.tsx` for color tokens). Suggested copy: `"This app uses analytics to improve your experience."` with primary "Accept" and secondary "Decline" buttons.

#### 2. Mount CookieConsent in _protected.tsx

**File**: `app/routes/_protected.tsx`

**Intent**: Render `<CookieConsent />` inside the protected layout so it appears on every authenticated page without duplicating it per route.

**Contract**: Import `CookieConsent` and render it once within the layout's JSX return — positioned outside the main scroll container (typically adjacent to `<Sidebar />` and `<Outlet />`) so it overlays content correctly.

### Success Criteria:

#### Automated Verification:

- `npm run typecheck` passes
- `npm run build` passes

#### Manual Verification:

- Clear localStorage, load the app: consent bar appears at the bottom of every protected page
- Click Accept: bar disappears immediately; Network tab shows requests to `eu.i.posthog.com`
- Reload: bar does not reappear; `localStorage.getItem('ph_consent') === 'accepted'`
- Clear localStorage, load app, click Decline: bar disappears; no requests to `eu.i.posthog.com`
- Reload after decline: bar does not reappear; `localStorage.getItem('ph_consent') === 'declined'`

---

## Phase 4: Event Instrumentation

### Overview

Add `posthog.capture()` calls at all 12 event sites across 6 files. All components use the `usePostHog()` hook. Events fire after the corresponding Firestore write (or auth operation) succeeds — never before.

### Changes Required:

#### 1. login.tsx — user_signed_in, whitelist_rejected

**File**: `app/routes/login.tsx`

**Intent**: Capture `user_signed_in` when a whitelisted member successfully authenticates, and `whitelist_rejected` (with email as a triage property) when OAuth succeeds but the email is not on the allowlist.

**Contract**: Add `usePostHog()` hook. In `handleSignIn()`:
- When `allowedEmails.includes(email)` passes: `posthog?.capture('user_signed_in')` — no additional properties (identity is already set by the auth context)
- When email is not allowed: `posthog?.capture('whitelist_rejected', { email: result.user.email })` before `signOut(auth)` — the only event in the taxonomy that carries an email property (admin triage use case)

#### 2. Sidebar.tsx — user_signed_out

**File**: `app/components/Sidebar.tsx`

**Intent**: Capture sign-out as a named event, then reset PostHog identity. Order matters: capture before reset.

**Contract**: Add `usePostHog()` hook. In `handleSignOut()`, before the existing `signOut(auth)` call:
```typescript
posthog?.capture('user_signed_out');
posthog?.reset();
```

#### 3. RejectionScreen.tsx — user_signed_out

**File**: `app/components/RejectionScreen.tsx`

**Intent**: Same sign-out instrumentation at the rejection screen. Rejected users who explicitly click "Sign Out" should generate the same named event.

**Contract**: Add `usePostHog()` hook. In `handleSignOut()`, before `signOut(auth)`:
```typescript
posthog?.capture('user_signed_out');
posthog?.reset();
```

#### 4. challenges.new.tsx — challenge_created

**File**: `app/routes/challenges.new.tsx`

**Intent**: Capture challenge creation after Firestore write succeeds, before navigating away (component unmounts on navigate).

**Contract**: Add `usePostHog()` hook. In `handleSubmit()`, after `addDoc` resolves and before `navigate('/')`:
```typescript
posthog?.capture('challenge_created', { has_description: description.trim().length > 0 });
```

Do not capture the title value — content is not analytics data.

#### 5. ChallengeCard.tsx — submission_form_opened, submission_published

**File**: `app/components/ChallengeCard.tsx`

**Intent**: Capture form-open as an intent signal and form-submit as a conversion. The open event must fire only when the form transitions from closed to open (not on close).

**Contract**: Add `usePostHog()` hook.

For `submission_form_opened` (currently at line 90, `setFormOpen(v => !v)`): replace with:
```typescript
const opening = !formOpen;
setFormOpen(opening);
if (opening) posthog?.capture('submission_form_opened', { challenge_id: challenge.id });
```

For `submission_published`: in `handleSubmit()`, after `addDoc` resolves and before `setFormOpen(false)`:
```typescript
posthog?.capture('submission_published', {
  challenge_id: challengeId,
  reflection_length: reflection.trim().length,
});
```

#### 6. SubmissionCard.tsx — 6 events

**File**: `app/components/SubmissionCard.tsx`

**Intent**: Instrument the remaining six event types: follow-up intent and publication, comment posting and deletion, submission deletion, and reflection editing.

**Contract**: Add `usePostHog()` hook once at the top of the component. Apply to the following handler sites:

| Event | Site | Properties |
|---|---|---|
| `follow_up_form_opened` | Toggle at line 203 — open-only (same `opening` variable pattern as ChallengeCard) | `{ parent_submission_id: submission.id, challenge_id: submission.challengeId }` |
| `follow_up_published` | After `addDoc` in `handleFollowUp()` | `{ challenge_id: submission.challengeId, parent_submission_id: submission.id, reflection_length: fuReflection.trim().length }` |
| `comment_posted` | After `addDoc` in `handlePost()` | `{ submission_id: submission.id, text_length: commentText.trim().length }` |
| `comment_deleted` | After `deleteDoc` in `handleDeleteComment()` | `{ submission_id: submission.id }` |
| `submission_deleted` | After `deleteDoc` in `handleDeleteSubmission()`, before any navigation | `{ challenge_id: submission.challengeId }` |
| `reflection_edited` | After `updateDoc` in `handleEditReflection()` | `{ new_reflection_length: editReflection.trim().length }` |

Verify that `submission.challengeId` is available on the submission prop (the field is written to Firestore on create — `ChallengeCard.tsx:63` — and should be present on all submission documents returned from Firestore).

### Success Criteria:

#### Automated Verification:

- `npm run typecheck` passes
- `npm run build` passes

#### Manual Verification:

With cookie consent accepted and DevTools → Network filtered to `eu.i.posthog.com`:
- Sign in → `user_signed_in` appears in PostHog Live Events
- Create a challenge → `challenge_created` with `has_description` property
- Open the submission form → `submission_form_opened` fires once; closing and re-opening fires exactly once more per open
- Publish a submission → `submission_published` with `challenge_id` and `reflection_length` ≥ 50
- Post a comment → `comment_posted` with `submission_id` and `text_length` ≥ 10
- Delete a comment → `comment_deleted` with `submission_id`
- Open the follow-up form → `follow_up_form_opened` fires once on open
- Publish a follow-up → `follow_up_published` with `parent_submission_id` and `reflection_length` ≥ 50
- Edit a reflection → `reflection_edited` with `new_reflection_length`
- Delete a submission → `submission_deleted` with `challenge_id`
- Sign out → `user_signed_out` fires; subsequent page load has no identity-linked events
- Repeat the above with consent declined → zero events appear in PostHog Live Events

---

## Testing Strategy

### Manual Testing Steps:

1. Clear all localStorage. Load the app. Verify the consent bar appears.
2. Accept consent. Open DevTools → Network → filter `eu.i.posthog.com`. Confirm requests start flowing.
3. Walk the full member journey: sign in → view challenges → open form → publish submission → comment → delete comment → follow-up form → publish follow-up → edit reflection → delete submission → sign out.
4. Check PostHog → Live Events: all 12 events appear with correct properties and are attributed to the correct person.
5. In a fresh session, decline consent. Repeat the journey. Confirm zero events appear in PostHog Live Events.
6. Reload after accepting. Confirm the banner does not reappear. Confirm events continue.

### Edge Cases:

- Token expiry mid-session (auth state changes to null without user action): `posthog.reset()` fires from the auth context — no action required in event instrumentation files
- Rejection screen sign-out: `user_signed_out` fires, then `reset()`, then `navigate('/login')` — verify order
- Opening the submission form, then clicking Cancel, then re-opening: `submission_form_opened` should fire exactly twice (once per open)

## Performance Considerations

`posthog-js` lazy-loads its full script after init. Autocapture and session recording have negligible performance impact for a group of ~15 members. `capture_pageview: 'history_change'` fires on React Router navigation changes without additional instrumentation.

## References

- Research: `context/changes/post-hog-integration/research.md`
- Auth context hook: `app/context/auth.tsx:17`
- Provider mount site: `app/root.tsx:50-55`
- Submission form toggle: `app/components/ChallengeCard.tsx:90`
- Follow-up form toggle: `app/components/SubmissionCard.tsx:203`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Install & Configure PostHog

#### Automated

- [x] 1.1 `npm run typecheck` passes with no PostHog-related errors
- [x] 1.2 `npm run build` completes without error
- [x] 1.3 `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` present in `.env.example`

#### Manual

- [ ] 1.4 No requests to `eu.i.posthog.com` before consent accepted (verify once Phase 3 is done)

### Phase 2: Identity Wiring

#### Automated

- [x] 2.1 `npm run typecheck` passes

#### Manual

- [ ] 2.2 Signing in populates a person in PostHog with correct `uid` and `email`
- [ ] 2.3 Signing out ends the session (no further identity-linked events)

### Phase 3: Cookie Consent Component

#### Automated

- [x] 3.1 `npm run typecheck` passes
- [x] 3.2 `npm run build` passes

#### Manual

- [ ] 3.3 Banner appears on first load (localStorage cleared)
- [ ] 3.4 Accept: bar disappears, PostHog requests appear in Network tab
- [ ] 3.5 Reload after accept: bar does not reappear
- [ ] 3.6 Decline: bar disappears, no PostHog requests
- [ ] 3.7 Reload after decline: bar does not reappear

### Phase 4: Event Instrumentation

#### Automated

- [x] 4.1 `npm run typecheck` passes
- [x] 4.2 `npm run build` passes

#### Manual

- [ ] 4.3 `user_signed_in` in PostHog Live Events on login
- [ ] 4.4 `challenge_created` with `has_description` property
- [ ] 4.5 `submission_form_opened` fires once on open, not on close
- [ ] 4.6 `submission_published` with `challenge_id` and `reflection_length`
- [ ] 4.7 `comment_posted` with `submission_id` and `text_length`
- [ ] 4.8 `comment_deleted` with `submission_id`
- [ ] 4.9 `follow_up_form_opened` fires once on open, not on close
- [ ] 4.10 `follow_up_published` with `parent_submission_id` and `reflection_length`
- [ ] 4.11 `reflection_edited` with `new_reflection_length`
- [ ] 4.12 `submission_deleted` with `challenge_id`
- [ ] 4.13 `user_signed_out` fires before identity is cleared; no attributed events after
- [ ] 4.14 With consent declined: zero events in PostHog Live Events
