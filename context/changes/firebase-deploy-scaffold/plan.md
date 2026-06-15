# Firebase Deploy Scaffold Implementation Plan

## Overview

Wire the React Router v7 scaffold for deployment on Firebase Hosting as a static SPA: flip SSR off, install the Firebase SDK, configure `firebase.json`, establish Blaze billing, and set up GitHub Actions CI/CD with a hardened service account. This is the foundation (F-01) that all downstream slices depend on — the deployment target and SDK initialization must be correct before Firebase Auth (F-02) or Firestore (F-03) can be wired.

## Current State Analysis

- `react-router.config.ts` has `ssr: true` — the scaffold default. Must be flipped to `ssr: false` to produce a static `build/client/` output that Firebase Hosting can serve.
- `package.json` carries two SSR-only deps (`@react-router/node`, `@react-router/serve`) and an SSR `start` script referencing `build/server/index.js` — none of these are meaningful in SPA mode.
- No `firebase.json`, `.firebaserc`, or `.github/workflows/` exist yet.
- No `firebase` npm package is installed.
- A Firebase project already exists; its project ID must be supplied during the manual deploy steps (Phase 2).
- Infrastructure research (`context/foundation/infrastructure.md`) has already decided: Firebase Hosting, `build/client` public dir, exact `firebase.json` rewrite structure, GitHub Actions via `FirebaseExtended/action-hosting-deploy`, `.env.local` + `import.meta.env` for client config.

## Desired End State

- `npm run build` produces a clean `build/client/` directory (no `build/server/`).
- `firebase deploy --only hosting` publishes the app to the live Firebase Hosting channel.
- A push to any branch with an open PR triggers an auto-created preview channel URL; merge to `main` triggers a live deploy — both via GitHub Actions, requiring no manual `firebase deploy`.
- The GitHub Actions service account is scoped to Hosting Admin + Service Account Token Creator (not the default GCP Editor).
- A $5/month GCP budget alert is active on the Blaze plan to catch unexpected usage.

### Key Discoveries

- `vite.config.ts:5` uses the standard `reactRouter()` plugin — no changes needed; it reads SSR mode from `react-router.config.ts` automatically.
- The `firebase.json` catch-all must NOT be the first rewrite rule — `/__/auth/**` must come before `**` or Firebase Auth email action URLs (password reset, email verification) will be served as `index.html`. Source: infrastructure.md unknown-unknowns section.
- Firebase client config (apiKey, projectId, etc.) is public by design — secured by Security Rules, not key secrecy. Storing in `VITE_FIREBASE_*` env vars is best practice for Vite projects, not a security requirement.
- `firebase init hosting:github` requires an interactive terminal and cannot be run unattended by an agent; it generates two workflow files and provisions the GitHub secret automatically.

## What We're NOT Doing

- No Firebase Auth wiring (F-02), no Firestore setup (F-03) — both depend on this but are separate slices.
- No Firebase Functions / SSR runtime — the app is a pure static SPA; Firestore Security Rules are the server-side enforcement layer.
- No `isbot` removal — harmless in SPA mode; not worth a separate change.
- No custom domain setup — Firebase Hosting's default `*.web.app` URL is sufficient for the MVP.
- No multi-environment config (staging vs production) — single Firebase project for now.

## Implementation Approach

Three phases in strict order:

1. All local file changes (ssr flip, deps, env vars, Firebase init stub) — fully agent-executable, no Firebase project access needed.
2. Firebase Hosting config files + first manual production deploy — requires Firebase CLI authentication and a real project ID; also the right moment to upgrade to Blaze and set the budget alert.
3. GitHub Actions CI/CD generation (interactive CLI) + IAM hardening (gcloud commands) — sets up automated deploys and tightens the service account scope.

## Critical Implementation Details

**`/__/auth/**` rewrite ordering**: Firebase Hosting's `**` catch-all intercepts ALL paths including Firebase's own internal auth action URLs. The `/__/auth/**` rule must appear first in the `rewrites` array, or email verification and password reset flows will silently return `index.html`. This is the one non-obvious ordering constraint in `firebase.json`.

**`firebase init hosting:github` provisions a GCP Editor role by default.** The generated service account JSON must have the `roles/editor` binding removed and replaced with `roles/firebasehosting.admin` + `roles/iam.serviceAccountTokenCreator` before the first CI/CD run. Phase 3 includes the exact `gcloud` commands.

---

## Phase 1: SPA Mode + Firebase SDK

### Overview

All local file changes that a code agent can apply without Firebase project access. After this phase the app builds as a static SPA and has a Firebase app initialization stub ready for F-02 and F-03 to build on.

### Changes Required

#### 1. Flip SSR flag

**File**: `react-router.config.ts`

**Intent**: Switch from SSR to SPA mode so `npm run build` produces `build/client/` (static files) instead of `build/server/` (Node.js server). This is the prerequisite for Firebase Hosting's static file serving.

**Contract**: Change `ssr: true` to `ssr: false`. No other changes needed — the `reactRouter()` Vite plugin reads this flag automatically.

#### 2. Clean up SSR-only package entries

**File**: `package.json`

**Intent**: Remove the two SSR-specific packages and their associated start script; they reference a `build/server/` output that no longer exists in SPA mode. Also correct the package name from the scaffold default.

**Contract**:
- `name`: change from `bootstrap-scaffold` to `photo-interest-group`
- Remove from `dependencies`: `@react-router/node`, `@react-router/serve`
- Remove `scripts.start` (references `react-router-serve ./build/server/index.js` — invalid in SPA mode)
- Add to `dependencies`: `firebase` (latest stable — run `npm install firebase` after editing)

#### 3. Firebase app initialization stub

**File**: `app/firebase.ts` (new)

**Intent**: Create a single Firebase app init module that all downstream feature modules (auth in F-02, firestore in F-03) import from. Centralizing `initializeApp` here ensures it's called exactly once.

**Contract**: Call `initializeApp(config)` with a config object where each field reads from `import.meta.env.VITE_FIREBASE_*`. Export the resulting `app` instance. No service-specific SDK calls (auth, firestore) belong here — those go in feature modules in F-02/F-03.

The snippet is necessary here because the signature contract (which env var names to use) is what `.env.local` and GitHub Secrets in Phase 3 must match exactly:

```typescript
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
```

#### 4. Environment variable template

**File**: `.env.example` (new, committed)

**Intent**: Commit a template showing all required `VITE_FIREBASE_*` variable names so any new contributor (or the CI setup steps in Phase 3) knows exactly what to supply.

**Contract**: Six lines, one per variable, all with empty values. Variable names must exactly match the keys in `app/firebase.ts`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

#### 5. Local environment file

**File**: `.env.local` (new, gitignored)

**Intent**: The local-dev copy of the Firebase client config; Vite loads it automatically. Values come from the Firebase Console (Project settings → Your apps → SDK setup and configuration).

**Contract**: Same six keys as `.env.example`, populated with real values from the Firebase Console. Verify `.gitignore` already contains `.env*.local` (the React Router scaffold includes this by default).

### Success Criteria

#### Automated Verification

- `npm install` completes without errors after the `firebase` package is added
- `npm run build` exits 0 and `build/client/index.html` exists (confirms SPA output)
- `npm run typecheck` exits 0 (confirms `app/firebase.ts` types are valid)
- No `build/server/` directory exists after `npm run build`

#### Manual Verification

- Open `build/client/index.html` in a browser via `npx serve build/client` — the welcome page loads with no console errors
- Confirm `.env.local` is not staged by `git status` (confirms `.gitignore` is working)

**Implementation Note**: After completing this phase and automated verification passes, pause for manual confirmation that the browser test and gitignore check pass before proceeding to Phase 2.

---

## Phase 2: Firebase Hosting Config + First Deploy

### Overview

Create the Firebase Hosting configuration files, upgrade the Firebase project to Blaze, set a budget alert, and run the first production deploy. This phase confirms the full path from `npm run build` to a live hosted URL works before CI/CD automation is added in Phase 3.

### Changes Required

#### 1. Firebase Hosting configuration

**File**: `firebase.json` (new)

**Intent**: Tell Firebase Hosting where the built files live and how to handle SPA routing. The auth rewrite must come first to avoid Firebase Auth email action URLs being served as `index.html`.

**Contract**:
```json
{
  "hosting": {
    "public": "build/client",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/__/auth/**", "destination": "/__/auth/handler" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```
The `/__/auth/**` rule must appear before `**`. This is the ordering constraint called out in Critical Implementation Details above.

#### 2. Firebase project binding

**File**: `.firebaserc` (new)

**Intent**: Bind the local Firebase CLI to the existing Firebase project so `firebase deploy` knows which project to target without requiring `--project` on every command.

**Contract**:
```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```
Replace `YOUR_FIREBASE_PROJECT_ID` with the actual project ID from the Firebase Console (Project settings → Project ID). This file is committed — it contains only the project ID, no secrets.

### Manual Steps (required before first deploy)

These steps require human interaction with the Firebase Console and GCP Console and cannot be automated by an agent.

- **Fill `.env.local`**: Paste the six Firebase config values from Firebase Console → Project settings → Your apps → SDK setup and configuration (Web app).
- **Upgrade to Blaze**: In the Firebase Console, click the plan badge (Spark) at the bottom-left → Upgrade → follow the GCP billing account setup wizard. Link a credit card if not already done. This is a one-time setup that prevents deploy-blocking if the 10 GB Spark egress cap is hit.
- **Set budget alert**: In GCP Console → Billing → Budgets & alerts → Create Budget. Scope to the Firebase project. Set threshold at $5/month with email notification. This catches unexpected Firestore or hosting cost spikes early.
- **Authenticate CLI**: Run `firebase login` (if not already logged in for this machine).
- **Bind project**: Run `firebase use YOUR_PROJECT_ID` to confirm `.firebaserc` is wired correctly.

### Success Criteria

#### Automated Verification

- `firebase serve` (after `npm run build`) serves the app at `localhost:5000` without errors

#### Manual Verification

- `firebase deploy --only hosting` exits 0 and prints a Hosting URL (`https://PROJECT_ID.web.app`)
- Open the Hosting URL in a browser — the welcome page loads
- Firebase Console → Hosting shows a release in the Release History table
- Firebase Console → Billing shows Blaze plan active
- GCP Console → Billing → Budgets shows the $5 alert configured

**Implementation Note**: After this phase, the app is live. Pause for manual confirmation before wiring CI/CD in Phase 3.

---

## Phase 3: GitHub Actions CI/CD + IAM Hardening

### Overview

Automate deploys via GitHub Actions (preview channels on PRs, live deploy on merge to `main`) and tighten the service account scope from GCP Editor to the minimum required roles.

### Changes Required

#### 1. GitHub Actions workflows (generated)

**Files**: `.github/workflows/firebase-hosting-merge.yml`, `.github/workflows/firebase-hosting-pr.yml` (both generated by `firebase init hosting:github`)

**Intent**: Automate the deploy pipeline. `firebase-hosting-pr.yml` deploys a preview channel on every PR update and posts the URL as a PR comment; `firebase-hosting-merge.yml` deploys to the live channel on every push to `main`.

**Contract**: Run the interactive CLI command — do not write these files manually:
```
firebase init hosting:github
```
When prompted:
- GitHub repo: enter your repo in `owner/repo` format
- Set up workflow for PRs: **Yes**
- PR workflow file: accept default (`firebase-hosting-pr.yml`)
- Set up automatic deploy on merge: **Yes**
- Branch to deploy on: `main`
- Merge workflow file: accept default (`firebase-hosting-merge.yml`)

The command provisions a GCP service account, downloads its key as JSON, and stores it as a `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` secret in the GitHub repo automatically. It also creates both workflow files.

#### 2. Set Firebase config secrets in GitHub

**Target**: GitHub repo → Settings → Secrets and variables → Actions

**Intent**: CI builds must be able to read `VITE_FIREBASE_*` env vars to embed the Firebase config at build time. These are not injected automatically by `firebase init`.

**Contract**: Create one Actions secret per variable, using the same names as `.env.example`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Then edit the generated `firebase-hosting-merge.yml` and `firebase-hosting-pr.yml` to inject these secrets as build-time env vars. In each workflow, add an `env:` block to the `npm run build` step:
```yaml
- name: Build
  run: npm run build
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
```

#### 3. IAM service account hardening

**Target**: GCP IAM (via `gcloud` CLI)

**Intent**: `firebase init hosting:github` provisions a service account with `roles/editor` (broad GCP write access). Scope it down to the minimum two roles actually needed by the deploy action.

**Contract**: Find the service account email in the JSON key file that was downloaded, or in GCP Console → IAM & Admin → Service Accounts. Then run:
```bash
# Set your values
PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
SA_EMAIL="YOUR_SERVICE_ACCOUNT_EMAIL"

# Remove the broad Editor role
gcloud projects remove-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/editor"

# Add minimum required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/firebasehosting.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Requires `gcloud` CLI authenticated to GCP (`gcloud auth login`). If `gcloud` is not installed, this step can be done via GCP Console → IAM & Admin → IAM → find the service account → Edit → remove Editor → add the two roles.

### Success Criteria

#### Automated Verification

- Push a branch with a trivial change (e.g., add a comment) and open a PR — GitHub Actions runs without errors and posts a preview channel URL as a PR comment
- Merge the PR — the merge workflow runs and deploys to the live channel (Firebase Console → Hosting → Release History shows a new entry triggered by GitHub Actions)

#### Manual Verification

- Preview channel URL from the PR loads the app correctly in a browser
- GCP Console → IAM & Admin → IAM confirms the service account no longer has `roles/editor`; `roles/firebasehosting.admin` and `roles/iam.serviceAccountTokenCreator` are present

**Implementation Note**: After this phase, all automated deploy infrastructure is in place and IAM is hardened. F-01 is complete; F-02 (auth) and F-03 (Firestore) can now be planned in parallel.

---

## Testing Strategy

### Automated Verification

- `npm run build` — confirms SPA output shape
- `npm run typecheck` — confirms `app/firebase.ts` types
- GitHub Actions CI run on PR — end-to-end smoke test of the deploy pipeline

### Manual Testing Steps

1. After Phase 1: open `build/client/index.html` locally via `npx serve` — welcome page loads
2. After Phase 2: open the `https://PROJECT_ID.web.app` Hosting URL — welcome page loads, no 404
3. After Phase 3: open the PR preview channel URL — same as step 2 but served from a preview channel
4. After IAM hardening: confirm the service account's effective permissions are narrowed in GCP Console

## Performance Considerations

No performance concerns at this phase — F-01 is pure infrastructure scaffolding. The SPA bundle size (currently just the React Router welcome screen) is negligible. Bundle size matters when Firebase SDK (auth, firestore) is imported in F-02/F-03; tree-shaking handles unused Firebase subpackages.

## Migration Notes

No existing data or users to migrate. The only "rollback" concern is the `firebase.json` rewrite order — if the `/__/auth/**` rule is missing, Firebase Auth email flows break silently. The Risk Register in `infrastructure.md` covers this.

## References

- Infrastructure research: `context/foundation/infrastructure.md`
- Roadmap F-01: `context/foundation/roadmap.md#f-01-firebase--deploy-scaffold`
- Firebase Hosting docs: `firebase.json` catch-all rewrite pattern and auth URL conflict documented in infrastructure.md unknown-unknowns section
- `FirebaseExtended/action-hosting-deploy`: the GitHub Action used for CI/CD

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SPA Mode + Firebase SDK

#### Automated

- [x] 1.1 `npm install` completes without errors after firebase package added — 402e771
- [x] 1.2 `npm run build` exits 0 and `build/client/index.html` exists — 402e771
- [x] 1.3 `npm run typecheck` exits 0 — 402e771
- [x] 1.4 No `build/server/` directory exists after build — 402e771

#### Manual

- [x] 1.5 Welcome page loads via `npx serve build/client` with no console errors — 402e771
- [x] 1.6 `.env.local` is not staged by `git status` — 402e771

### Phase 2: Firebase Hosting Config + First Deploy

#### Automated

- [x] 2.1 `firebase serve` serves app at `localhost:5000` without errors — bae0edb

#### Manual

- [x] 2.2 `firebase deploy --only hosting` exits 0 and prints Hosting URL — bae0edb
- [x] 2.3 Hosting URL loads the welcome page in a browser — bae0edb
- [x] 2.4 Firebase Console → Hosting shows a release in Release History — bae0edb
- [x] 2.5 Firebase Console → Billing shows Blaze plan active — bae0edb
- [x] 2.6 GCP Console → Billing → Budgets shows the $5 alert configured — bae0edb

### Phase 3: GitHub Actions CI/CD + IAM Hardening

#### Automated

- [x] 3.1 PR triggers GitHub Actions run without errors and posts preview channel URL — 471d7e0
- [x] 3.2 Merge to main triggers live deploy (Release History shows GitHub Actions entry) — 471d7e0

#### Manual

- [x] 3.3 Preview channel URL from PR loads the app correctly — 471d7e0
- [x] 3.4 GCP IAM confirms service account has `roles/firebasehosting.admin` and `roles/iam.serviceAccountTokenCreator` only (no `roles/editor`) — 471d7e0
