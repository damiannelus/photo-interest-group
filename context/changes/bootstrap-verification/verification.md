---
bootstrapped_at: 2026-06-14T00:00:00Z
starter_id: react-router
starter_name: React Router (formerly Remix)
project_name: photo-interest-group
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: react-router
package_manager: npm
project_name: photo-interest-group
hints:
  language_family: js
  team_size: solo
  deployment_target: firebase-hosting
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

**Why this stack:**

Solo developer building a small-group photo-sharing app in 1 week, after-hours. Custom path chosen because the user arrived with a specific Firebase (GCP) + React preference, ruling out the Supabase-bundled recommended default (10x-astro-starter). React Router v7 is the strongest qualifying starter: explicitly positioned as full-stack React without Vercel lock-in, passes all four agent-friendly gates, and deploys cleanly to Firebase Hosting as a static-export SPA. The 1-week timeline benefits from file-based routing — the agent navigates the route structure predictably without extra convention scaffolding. Firebase Auth covers Google OAuth (has_auth), and Firestore handles the challenges, submissions, comments, and whitelist data. The self-check flagged can_judge_agent as false (React Router v7 is new to the builder) — bootstrapper should include router-specific guidance in the generated instruction file. CI on GitHub Actions with auto-deploy on merge matches a solo project at this scope and scale.

## Pre-scaffold verification

| Signal      | Value                                               | Severity | Notes                                       |
| ----------- | --------------------------------------------------- | -------- | ------------------------------------------- |
| npm package | create-react-router v7.17.0 published 2026-06-04    | fresh    | resolved from cmd_template                  |
| GitHub repo | not run                                             | —        | docs_url points to reactrouter.com (not GitHub) |

## Scaffold log

**Resolved invocation**: `npx create-react-router@latest .bootstrap-scaffold --yes --package-manager npm`
**Strategy**: scaffold into a temporary directory then move files up
**Exit code**: 0
**Files moved**: 13 (`.git`, `app`, `node_modules`, `public`, `.dockerignore`, `.gitignore`, `Dockerfile`, `package-lock.json`, `package.json`, `react-router.config.ts`, `README.md`, `tsconfig.json`, `vite.config.ts`)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (no .gitignore existed in cwd)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 4 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/1/0/0 direct of total 0/4/0/0 (npm audit `isDirect` field)

#### CRITICAL findings

None.

#### HIGH findings

| Package | isDirect | Advisory | Description | Fix |
| ------- | -------- | -------- | ----------- | --- |
| `esbuild` | transitive | GHSA-gv7w-rqvm-qjhr | Missing binary integrity verification in Deno module enables remote code execution via NPM_CONFIG_REGISTRY. CVSS 8.1. | No fix available (requires esbuild >=0.28.1) |
| `esbuild` | transitive | GHSA-g7r4-m6w7-qqqr | Allows arbitrary file read when running the dev server on Windows. CVSS 2.5 (low severity advisory, aggregated to HIGH by npm). | No fix available (requires esbuild >=0.28.1) |
| `vite` | transitive | via esbuild | Affected by esbuild advisory above. Range: 4.2.0-beta.0–8.0.3. | No fix available |
| `vite-node` | transitive | via vite | Affected by vite/esbuild chain. Range: 1.0.0-beta.0–5.3.0. | No fix available |
| `@react-router/dev` | **direct** | via vite-node | Affected by vite-node/esbuild chain. Range: <=7.17.0. | No fix available |

**Context**: All 4 HIGH advisories trace to a single root cause — `esbuild <0.28.1` in the `vite-node` sub-tree. The `esbuild` GHSA-gv7w-rqvm-qjhr advisory (RCE via NPM_CONFIG_REGISTRY) only materialises in a Deno environment — not in the standard npm/Node.js dev workflow this project uses. The Windows file-read issue (GHSA-g7r4-m6w7-qqqr) applies to the dev server. Neither advisory affects production builds or Firebase Hosting deployments. No fix is available yet — `fixAvailable: false` for all entries — so `npm audit fix` cannot resolve them.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value              |
| ----------------------- | ------------------ |
| bootstrapper_confidence | verified           |
| quality_override        | false              |
| path_taken              | custom             |
| self_check_answers      | typed: true, from_official_starter: true, conventions: true, docs_current: true, **can_judge_agent: false** |
| team_size               | solo               |
| deployment_target       | firebase-hosting   |
| ci_provider             | github-actions     |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true               |
| has_payments            | false              |
| has_realtime            | false              |
| has_ai                  | false              |
| has_background_jobs     | false              |

Note: `can_judge_agent: false` was flagged during stack selection because React Router v7 is new to the builder. A future skill (M1L4) will generate `CLAUDE.md` / `AGENTS.md` with router-specific guidance to compensate.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review the 4 HIGH audit findings above — all trace to `esbuild <0.28.1` in the dev toolchain (not production); risk is low for this project's threat model but worth watching for upstream fixes.
- `git init` is not needed — the React Router CLI already ran `git init` inside the scaffold; the `.git/` directory was moved into your project root.
- No `.scaffold` sibling conflicts were created — all scaffold files landed cleanly.
- Address Firebase-specific wiring next: add the Firebase SDK, configure `firebase.json`, set up Firebase Auth for Google OAuth.
