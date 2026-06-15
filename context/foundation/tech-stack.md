---
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
---

## Why this stack

Solo developer building a small-group photo-sharing app in 1 week, after-hours. Custom path chosen because the user arrived with a specific Firebase (GCP) + React preference, ruling out the Supabase-bundled recommended default (10x-astro-starter). React Router v7 is the strongest qualifying starter: explicitly positioned as full-stack React without Vercel lock-in, passes all four agent-friendly gates, and deploys cleanly to Firebase Hosting as a static-export SPA. The 1-week timeline benefits from file-based routing — the agent navigates the route structure predictably without extra convention scaffolding. Firebase Auth covers Google OAuth (has_auth), and Firestore handles the challenges, submissions, comments, and whitelist data. The self-check flagged can_judge_agent as false (React Router v7 is new to the builder) — bootstrapper should include router-specific guidance in the generated instruction file. CI on GitHub Actions with auto-deploy on merge matches a solo project at this scope and scale.
