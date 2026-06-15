---
project: "Photo Interest Group"
researched_at: 2026-06-14
recommended_platform: Firebase Hosting
runner_up: Cloudflare Pages
context_type: mvp
tech_stack:
  language: TypeScript
  framework: React Router v7 (SPA mode, ssr: false)
  runtime: static bundle (no server runtime)
  database: Firestore
  auth: Firebase Auth
---

## Recommendation

**Deploy on Firebase Hosting.**

The app already commits to Firebase Auth and Firestore — hosting on Firebase Hosting keeps all services co-located in a single GCP project, eliminating cross-origin complexity, unifying Security Rules, and sharing the same billing account. The Spark free plan covers the MVP at this scale (5–15 users, low QPS), and the official Firebase MCP server (integrated into `firebase-tools`) makes the platform directly manageable from Claude Code without context-switching. The single mandatory config step is a catch-all rewrite rule in `firebase.json`; everything else deploys in one command.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Firebase Hosting** | Partial | Pass | Pass | Pass | Pass | **4.5 / 5** |
| **Cloudflare Pages** | Partial | Pass | Pass | Pass | Pass | **4.5 / 5** |
| **Vercel** | Pass | Pass | Pass | Pass | Pass | **5 / 5** |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | **4.5 / 5** |

**Partial scores explained:**
- Firebase Hosting: rollback is a 3-step CLI sequence (list → clone → re-deploy), not a single command
- Cloudflare Pages: `wrangler pages rollback` does not exist; rollback via dashboard/API only
- Netlify: no `netlify rollback` CLI command; dashboard or REST API only
- Vercel is the only platform with a single `vercel rollback` command

**Soft-weight factors (from developer interview):**

| Factor | Winner | Notes |
|---|---|---|
| Minimize cost | Cloudflare Pages ($0, unlimited static requests) | Firebase Spark has 10 GB egress cap; Netlify credits are uncertain at scale; Vercel Hobby is non-commercial only |
| Firebase/GCP familiarity | Firebase Hosting | Breaks the Firebase / Cloudflare tie |
| Global CDN reach | Cloudflare Pages (300+ PoPs) | Firebase (Google CDN) is excellent; Vercel has 126 PoPs |
| Co-location preferred | Firebase Hosting (decisive) | Auth + Firestore already in the same project |

### Shortlisted Platforms

#### 1. Firebase Hosting (Recommended)

Already co-located with Firebase Auth and Firestore in the same GCP project. The Spark free plan covers static hosting at this scale (10 GB egress/month, 10 GB storage). Preview channels are built in (up to 7 on Spark). The GitHub Actions integration (`FirebaseExtended/action-hosting-deploy`) auto-creates preview channel URLs on every PR and deploys to the live channel on merge. The official Firebase MCP server, bundled with `firebase-tools`, enables full management from Claude Code — Firestore, Auth, Hosting, and Cloud Functions are all accessible as structured tool calls.

#### 2. Cloudflare Pages

The strongest alternative if cost is paramount or the Firebase ecosystem is ever abandoned. Truly $0 for unlimited static request traffic (Cloudflare charges no egress fees on any plan). The CDN spans 300+ points of presence globally — the widest distribution of any platform evaluated. Firebase Auth and Firestore work cleanly as external HTTPS services from the browser; no Cloudflare service integration is required. Five official remote MCP servers (general, docs, bindings, builds, observability) give excellent agent tooling coverage. Only gaps: the developer has no existing Cloudflare familiarity, and rollback requires the dashboard or REST API rather than a single CLI command.

#### 3. Vercel

The best CLI experience of all platforms evaluated — `vercel rollback` is a single command, and `vercel logs` supports rich filtering. The official Vercel MCP server (GA at `mcp.vercel.com`) covers project management, deployment details, and log access. The main risk is the **Hobby plan non-commercial restriction**: Vercel's ToS explicitly prohibits commercial use on the free tier, and the definition is broad (paid consultants writing the code counts as commercial). For a hobby group app with no monetization this is likely acceptable, but the ambiguity is a real risk that the other platforms don't carry.

## Anti-Bias Cross-Check: Firebase Hosting

### Devil's Advocate — Weaknesses

1. **Rollback is a 3-step CLI procedure** — `firebase hosting:versions:list` → `firebase hosting:versions:clone` → `firebase deploy`. Every shortlisted alternative handles rollback more cleanly. Under time pressure this is friction.
2. **Spark plan bandwidth ceiling strikes without warning** — 10 GB egress/month is the hard free-tier cap. A new deploy invalidates CDN caches; a traffic spike after a cache-busting deploy can hit the ceiling before the billing cycle resets. On Spark, hitting the limit **blocks new deploys** (Firestore stays live; Hosting freezes).
3. **Preview channels capped at 7 on Spark** — with multiple open feature branches, channels must be manually pruned before new ones can be created. Cloudflare Pages and Vercel impose no such cap on preview URLs at the free tier.
4. **Upgrading to Blaze is non-trivial under pressure** — moving from Spark to Blaze (pay-as-you-go) requires creating a GCP billing account with a valid payment method and linking it to the project. GCP billing verification can involve 3DS or review delays; this should be set up proactively, not reactively at 2 AM when Spark limits are hit.
5. **Firebase Security Rules add operational scope** — co-location is a strength, but it means Firestore Security Rules become critical infrastructure owned by the developer. An overly permissive rule exposes all data regardless of app-level auth enforcement, and there is no WAF or additional protection layer on Spark.

### Pre-Mortem — How This Could Fail

The team deployed the React Router v7 SPA on Firebase Hosting (Spark plan). Month 1 was smooth. In month 2, the group grew and photo submissions became more frequent. A member shared the link externally; traffic spiked, the 10 GB bandwidth ceiling was hit mid-month, and new deploys were blocked. Upgrading to Blaze required setting up a GCP billing account the developer hadn't prepared — the credit card needed 3DS verification, adding two days of delay during active development.

Once on Blaze, cost management became a new responsibility the developer hadn't planned for. The initial Firestore Security Rules (`allow read, write: if auth != null`) had never been tightened — any authenticated member could write to any collection. A bug in the submission form caused 500 duplicate Firestore writes before it was caught, generating unexpected charges. Meanwhile, the 7-channel preview limit on Spark had already trained the developer to skip preview deploys and push straight to production — a habit that persisted post-upgrade. No single failure was catastrophic, but the compounding friction (billing setup, security expertise, channel limits, 3-step rollback) made Firebase feel heavier than expected for what started as a simple static host.

### Unknown Unknowns

- **`firebase.json` catch-all conflicts with Firebase Auth email action URLs.** Firebase Auth email verification and password reset links point to `https://yourapp.firebaseapp.com/__/auth/action`. If the catch-all rewrite `{ "source": "**", "destination": "/index.html" }` is placed first, these Firebase-generated URLs are swallowed and serve `index.html` instead — breaking email flows. Fix: place explicit rewrites for `/__/auth/action` before the catch-all. Not prominently documented in the getting-started guide.
- **Firebase App Hosting ≠ Firebase Hosting.** Since 2024, Firebase ships two hosting products. Tutorials and search results increasingly surface "Firebase App Hosting" (an SSR product with `apphosting.yaml`). For a static SPA, classic Firebase Hosting with `firebase.json` is the correct product.
- **Preview channel URLs are publicly accessible by URL.** Firebase preview channel URLs are not password-protected. The SPA's HTML/JS bundle is reachable by anyone who knows the URL — only Firebase Auth (client-side) restricts data. Acceptable for this use case, but worth knowing during PR review workflows.
- **`action-hosting-deploy` creates a broad GCP service account.** `firebase init hosting:github` provisions a service account with GCP Editor-level permissions. A compromised GitHub secret gives write access to all Firebase services in the project, not just Hosting. Scope it to the minimum required roles after setup.
- **Brotli only applies to cached CDN responses.** After a fresh deploy or a cold edge region, Firebase serves gzip or uncompressed until the cache warms. Irrelevant at this scale but worth knowing when benchmarking first-load performance.

## Operational Story

- **Preview deploys:** `firebase hosting:channel:deploy pr-123 --expires 7d` creates a preview channel at `https://PROJECT--pr-123-HASH.web.app`. The `action-hosting-deploy` GitHub Action automates this on PR open/update and posts the URL as a PR comment. Preview channel URLs are publicly accessible by URL (no built-in password protection); Firebase Auth enforces data access client-side.
- **Secrets:** Firebase client config (API key, project ID, etc.) is public by design — it is embedded in the built JS bundle and secured by Firebase Security Rules and Auth, not by keeping the key secret. The GitHub Actions secret to protect is `FIREBASE_SERVICE_ACCOUNT` (the GCP service account JSON generated by `firebase init hosting:github`). Rotate it via GCP IAM by generating a new service account key and updating the GitHub repository secret.
- **Rollback:** Three steps: `firebase hosting:versions:list` to find the target version ID → `firebase hosting:versions:clone SOURCE_VERSION_ID` to duplicate it → `firebase deploy --only hosting` to make it live. Alternatively, one-click from the Firebase Console's Release History table. Typical time-to-rollback: 2–5 minutes. Data (Firestore) does not roll back automatically — schema and data migrations must be managed separately.
- **Approval:** Pushes to `main` trigger an automatic live deploy via GitHub Actions — no human approval gate is configured by default. An agent may trigger `firebase deploy --only hosting` unattended via the service account. Actions requiring a human: attaching a GCP billing account (Spark → Blaze upgrade), rotating the service account secret, adding/removing Firestore Security Rules in production.
- **Logs:** Firebase Hosting (static CDN) does not produce server-side logs per request. Cloud Functions logs are available via `firebase functions:log` or `firebase functions:log --only FUNCTION_NAME`. Runtime errors in the React SPA are client-side only and require a browser error monitoring tool (e.g., Sentry) to capture. The Firebase MCP server (via Claude Code) exposes Hosting, Firestore, and Auth management as structured tool calls without needing to tail logs manually.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Spark bandwidth ceiling (10 GB/month) hit, blocking new deploys | Devil's advocate | M | H | Switch to Blaze (pay-as-you-go) proactively before launch; set a GCP budget alert at $5/month to catch unexpected usage early |
| GCP billing account not set up when Spark limits are hit | Pre-mortem | M | M | Create the GCP billing account and link it to the project during setup, before the Spark limit becomes a concern |
| `firebase.json` catch-all swallows Firebase Auth email action URLs | Unknown unknowns | H | M | Place `/__/auth/action` rewrite before the catch-all in `firebase.json` during initial configuration |
| Overly permissive Firestore Security Rules expose all data | Devil's advocate | M | H | Write and test Security Rules before launch; use the Firebase Emulator Suite to verify rules in isolation |
| `action-hosting-deploy` service account has GCP Editor scope | Unknown unknowns | L | H | After `firebase init hosting:github`, narrow the service account to minimum required roles (Hosting Admin + Service Account Token Creator) via GCP IAM |
| Preview channel cap (7 channels on Spark) blocks PR workflow | Devil's advocate | L | L | Upgrade to Blaze or prune stale channels via `firebase hosting:channel:list` + `firebase hosting:channel:delete` |
| Firebase App Hosting docs confusion during research/setup | Unknown unknowns | M | L | When searching Firebase docs, always verify the product is "Firebase Hosting" (not "App Hosting"); config file is `firebase.json`, not `apphosting.yaml` |
| 3-step rollback under time pressure | Devil's advocate | L | M | Document the rollback procedure in the project README before launch; Blaze plan allows rollback from the Firebase Console in one click |

## Getting Started

1. **Install the Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in and initialize the project** (select "Hosting" when prompted; point the public directory to `build/client`):
   ```bash
   firebase login
   firebase init hosting
   # Public directory: build/client
   # Single-page app: Yes (adds the catch-all rewrite automatically)
   # Overwrite index.html: No
   ```

3. **Patch `firebase.json`** to place the Auth action rewrite before the catch-all (prevents email verification links from serving `index.html`):
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

4. **Wire up GitHub Actions** for CI/CD (auto-creates preview channels on PRs, deploys to live on merge to `main`):
   ```bash
   firebase init hosting:github
   # Follow prompts — generates FIREBASE_SERVICE_ACCOUNT secret in GitHub
   ```

5. **Test a local preview build before the first deploy**:
   ```bash
   npm run build           # produces build/client/
   firebase serve          # local preview at localhost:5000
   firebase deploy --only hosting   # first production deploy
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup beyond the Firebase GitHub Actions integration
- Production-scale architecture (multi-region, HA, DR)
