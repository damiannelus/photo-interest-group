# Repository Guidelines

Photo Interest Group is a web app for small photographer groups (5–15 members) to share photos with mandatory written reflection before publishing. Stack: React Router v7 (SSR), React 19, TypeScript 5.9, Tailwind CSS 4, Vite 8, Firebase Auth + Firestore, deployed to Firebase Hosting.

## Hard Rules

- **Reflection is unconditional.** Every photo submission must persist a `reflection` value of at least 50 characters. No code path — UI, loader, action, or direct Firestore write — may bypass this check. A missing or short reflection is a critical bug, not a validation edge case.
- **Parent link integrity.** Follow-up submissions must correctly store `parent_submission_id`. A null or missing link is a critical bug.
- **URL-based photos only.** Submissions store a hosted image URL. Do not introduce Firebase Storage or file-upload logic for MVP.
- **Google OAuth only.** No in-app member invite UI; whitelist is managed out-of-band. Do not add email/password auth or invite flows.

## Project Structure

- `app/` — React Router app root (`root.tsx`, `app.css`, `routes.ts`)
- `app/routes/` — route modules; co-locate loaders, actions, and their default-export components
- `app/welcome/` — welcome page components
- `context/` — 10x planning artifacts (PRD, tech-stack, changes); read-only during feature work
- `public/` — static assets
- `Dockerfile` — multi-stage Node 20 Alpine build; see `@Dockerfile`

Use the `~/*` path alias for all `app/` imports (e.g., `~/routes/home`, `~/components/button`). Never use relative paths that cross directory boundaries.

## Build, Dev, and Deploy Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build via React Router |
| `npm run start` | Serve production build on port 3000 |
| `npm run typecheck` | Run `react-router typegen` then `tsc --noEmit` |

See `@package.json` for the full scripts block. Run `npm run typecheck` before every commit. No automated test suite exists yet.

## Coding Style

TypeScript strict mode is on (`@tsconfig.json`). SSR is enabled — guard any `window` or `document` access with a browser environment check; do not rely on browser globals in route module top-level code. Route modules in `app/routes/` export a `loader`, `action`, and a default React component. Use Tailwind CSS 4 utility classes; do not create per-component CSS files alongside route modules.

## Commit Guidelines

No convention is established (one initial commit; no remote configured). Use plain imperative messages until a convention is agreed. PR target and remote are TBD.
