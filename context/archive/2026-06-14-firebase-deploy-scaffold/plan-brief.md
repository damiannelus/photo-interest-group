# Firebase Deploy Scaffold — Plan Brief

> Full plan: `context/changes/firebase-deploy-scaffold/plan.md`
> Research: `context/foundation/infrastructure.md`

## What & Why

Wire the React Router v7 scaffold for static-SPA deployment on Firebase Hosting. This is F-01 — the infrastructure foundation every downstream slice (auth, Firestore, submission feed) depends on. Without it, Firebase Auth cannot be initialized and Firestore Security Rules have nowhere to run.

## Starting Point

The scaffold runs today with `ssr: true` and no Firebase packages. It builds an SSR bundle to `build/server/`; Firebase Hosting expects a static bundle in `build/client/`. No `firebase.json`, no CI/CD, no Firebase SDK, no env vars.

## Desired End State

`npm run build` produces a clean `build/client/` static bundle. `firebase deploy --only hosting` publishes to a live Firebase Hosting URL. Every PR auto-gets a preview channel URL; merges to `main` auto-deploy to live — all via GitHub Actions. The service account driving CI is scoped to minimum required GCP roles. A $5/month budget alert guards against unexpected Blaze costs.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| SSR vs. static export | Static SPA (`ssr: false`) | No Node runtime needed; Firestore Security Rules are the server-side enforcement layer; simpler deploy target |
| Hosting platform | Firebase Hosting | Co-located with Auth + Firestore in same GCP project; avoids cross-origin complexity |
| Firebase client config storage | `.env.local` + `VITE_FIREBASE_*` + GitHub Secrets for CI | Never commits keys; Vite replaces at build time; consistent local ↔ CI |
| Service account scope | Narrow post-init to Hosting Admin + SA Token Creator | `firebase init hosting:github` defaults to broad GCP Editor; reduced blast radius if secret is leaked |
| Billing plan | Blaze + $5 budget alert | Spark's 10 GB egress cap blocks new deploys when hit; Blaze prevents the mid-development billing scramble from the infrastructure pre-mortem |

## Scope

**In scope:**
- Flip `react-router.config.ts` to `ssr: false`
- Remove SSR-only deps (`@react-router/node`, `@react-router/serve`, `start` script)
- Install `firebase` npm package
- Create `app/firebase.ts` init stub (exports `app`; F-02/F-03 import from it)
- Create `.env.example` (committed) and `.env.local` (gitignored)
- Create `firebase.json` (with `/__/auth/**` before `**` catch-all) and `.firebaserc`
- First manual `firebase deploy --only hosting`
- Upgrade to Blaze + $5 GCP budget alert
- GitHub Actions workflows via `firebase init hosting:github`
- Set `VITE_FIREBASE_*` as GitHub Actions secrets + inject into build steps
- IAM hardening: remove `roles/editor`, add `roles/firebasehosting.admin` + `roles/iam.serviceAccountTokenCreator`

**Out of scope:**
- Firebase Auth (F-02), Firestore schema/rules (F-03)
- Custom domain configuration
- Multi-environment (staging vs production)
- Firebase Functions / SSR runtime

## Architecture / Approach

Three phases in strict order. Phase 1 is all agent-executable local file changes (no Firebase access needed). Phase 2 requires human interaction: fill env vars from Firebase Console, upgrade billing in GCP Console, run first deploy. Phase 3 is the interactive `firebase init hosting:github` command that generates workflow files and provisions GitHub Secrets, followed by `gcloud` IAM commands to narrow the service account. The ordering matters: CI/CD is wired only after a confirmed manual deploy (Phase 2), so the pipeline is never the first test of a broken configuration.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. SPA Mode + Firebase SDK | `npm run build` → `build/client/`; `app/firebase.ts` stub; env var files | `firebase` package import may cause TypeScript errors if tsconfig isn't module-aware (unlikely with current tsconfig) |
| 2. Hosting Config + First Deploy | Live URL on Firebase Hosting; Blaze billing active; budget alert set | Firebase project ID typo in `.firebaserc` causes confusing CLI errors; Blaze billing setup may require 3DS verification |
| 3. CI/CD + IAM Hardening | Auto-deploys on PR + merge; service account scoped down | `firebase init hosting:github` is interactive; cannot be run by an agent unattended. `gcloud` must be installed for IAM commands |

**Prerequisites:** Firebase project must exist (confirmed). Firebase CLI (`firebase-tools`) must be installed globally. `gcloud` CLI must be installed for Phase 3 IAM hardening.

**Estimated effort:** ~1 focused session across 3 phases. Phase 1 is agent-executable in minutes. Phase 2 adds ~15 min of manual Firebase/GCP Console work. Phase 3 adds ~10 min for the interactive CLI + IAM commands.

## Open Risks & Assumptions

- GCP billing account may require 3DS card verification during Phase 2 Blaze setup — set aside time; this cannot be rushed.
- `firebase init hosting:github` must be run from a machine that can open a browser for OAuth (not a headless CI environment). Run it locally.
- If `gcloud` CLI is not installed, Phase 3 IAM hardening falls back to GCP Console UI (documented as an alternative in the plan).
- The plan assumes the GitHub repo already exists and the user has admin access (needed to create Actions secrets).

## Success Criteria (Summary)

- `npm run build` produces `build/client/` and `npm run typecheck` passes
- `firebase deploy --only hosting` publishes a live URL that loads the app
- PR preview channels are auto-created; merges to `main` auto-deploy; service account has no `roles/editor`
