# PostHog Integration — Plan Brief

> Full plan: `context/changes/post-hog-integration/plan.md`
> Research: `context/changes/post-hog-integration/research.md`

## What & Why

The Photo Interest Group app ships with zero analytics. Adding PostHog gives the team visibility into how members use the reflection-gated submission flow — the core product hypothesis the app was built to prove. Without it, there is no data to answer whether members engage with follow-ups, which challenges attract submissions, or where drop-off occurs.

## Starting Point

All 8 feature slices (auth, challenges, submissions, follow-ups, comments) are complete and production-ready. The app has no analytics code, no tracking libraries, and no observability of any kind — a fully clean slate.

## Desired End State

Every whitelisted member who accepts the cookie consent banner generates 12 named PostHog events as they use the app. Session recordings are captured. Members who decline analytics are completely silent to PostHog. The consent banner appears once on first use and never reappears.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| PostHog region | EU (`eu.i.posthog.com`) | GDPR proximity for a Polish-based group | Plan |
| Session recording | ON | Full context for a small trusted group; no privacy risk | Plan |
| Cookie consent behavior | Hard opt-out on decline | Cleanest GDPR story; zero data for members who decline | Plan |
| Banner style | Minimal fixed bottom bar | Unobtrusive for a known-member private app | Plan |
| Consent gate mechanism | `loaded` callback in PostHogConfig | Only place that reliably blocks capture before consent; fires synchronously on init | Plan |
| Identity source | `user.uid` as distinct_id, `user.email` as person property | uid is stable and non-PII in event stream; email for human-readable identity | Research |
| Identity wiring location | `app/context/auth.tsx` onAuthStateChanged | Single callback that fires on every auth state change — identify/reset in one place | Research |
| Import style (components) | `usePostHog()` hook | React-idiomatic; recommended by PostHog docs | Plan |
| Import style (auth context) | Direct `import posthog from 'posthog-js'` | Effect callback, not a render; singleton access is cleaner than hook here | Plan |
| sign-out event | `capture('user_signed_out')` + `reset()` | Named event enables voluntary sign-out vs. session timeout analysis | Plan |
| `whitelist_rejected` email property | Include email only on this event | Admin triage use case; the only event where pre-identity email matters | Research |

## Scope

**In scope:**
- `posthog-js` installation and EU-region `PostHogProvider` in `app/root.tsx`
- User identity: `identify()` on login, `reset()` on sign-out, via `app/context/auth.tsx`
- Cookie consent bottom bar with hard opt-out (`app/components/CookieConsent.tsx`)
- 12 named events across 6 files (see event taxonomy in research doc)
- `capture_pageview: 'history_change'` for SPA navigation tracking

**Out of scope:**
- PostHog feature flags or A/B testing
- Server-side event capture
- Cookie policy page
- Content properties (reflection text, comment text, challenge titles, photo URLs)
- Custom PostHog dashboards (configured in PostHog UI, not code)

## Architecture / Approach

```
app/root.tsx
  <PostHogProvider options={{ loaded: opt-out-if-no-consent, ... }}>
    <AuthProvider>                    ← posthog.identify()/reset() here
      <_protected.tsx layout>
        <CookieConsent />             ← opt_in/opt_out_capturing()
        <Sidebar />                   ← user_signed_out + reset()
        <Outlet>
          challenges.tsx              ← (no events — read-only feed)
          challenges.new.tsx          ← challenge_created
          ChallengeCard.tsx           ← submission_form_opened, submission_published
          SubmissionCard.tsx          ← 6 events: follow-up, comments, edit, delete
        </Outlet>
      <login.tsx>                     ← user_signed_in, whitelist_rejected
      <RejectionScreen.tsx>           ← user_signed_out + reset()
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Install & Configure | `posthog-js` installed; `PostHogProvider` in root with EU config and consent gate | Missing `loaded` callback = events fire before consent |
| 2. Identity Wiring | `identify()`/`reset()` in auth context; persons appear in PostHog on sign-in | Wrong `distinct_id` = broken person linkage across sessions |
| 3. Cookie Consent | Bottom bar + opt-in/opt-out logic; localStorage persistence | Banner reappearing on reload = poor UX |
| 4. Event Instrumentation | All 12 events captured with correct properties | Toggle events firing on close (not just open) = inflated counts |

**Prerequisites:** PostHog project created in the EU region; API key available before Phase 1.  
**Estimated effort:** ~2-3 short sessions across 4 phases. Phase 4 is the widest (6 files) but mechanical.

## Open Risks & Assumptions

- `submission.challengeId` must be present on the submission Firestore document as read by `SubmissionCard` — confirmed in research (field is written on create) but should be verified in the TypeScript type definition before Phase 4
- PostHog API key must be obtained from the PostHog UI before starting; not part of this implementation

## Success Criteria (Summary)

- All 12 events appear in PostHog Live Events when walking the full member journey with consent accepted
- Zero PostHog network requests appear when consent is declined (or not yet given)
- Persons in PostHog are identified by `uid` with correct `email` property after sign-in
