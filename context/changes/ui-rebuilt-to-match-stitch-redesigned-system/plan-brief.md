# UI Rebuild — Stitch Design — Plan Brief

> Full plan: `context/changes/ui-rebuilt-to-match-stitch-redesigned-system/plan.md`
> Research: `context/changes/ui-rebuilt-to-match-stitch-redesigned-system/research.md`

## What & Why

Replace the entire visual layer to match the Stitch "High-Utility Technical Minimalism" design — a photography-focused, deep dark-mode aesthetic inspired by Linear/Vercel. The current app has two completely unstyled screens (login, rejection), no navigation header, and a tiny 64×64 thumbnail for photo submissions. The redesign makes photography the visual focus and gives the app a coherent professional identity.

## Starting Point

The app has 4 routes and 2 components. Two of them (`challenges.tsx`, `challenges.new.tsx`) are already Tailwind-styled with a blue-600/gray palette and dark-mode variants. Two (`login.tsx`, `RejectionScreen.tsx`) use bare inline `style={{}}`. There is no sidebar, no sign-out affordance, and no shared app shell beyond a thin auth guard.

## Desired End State

The app renders exclusively in dark mode (`#11131b` background, `#1d1f27` card surfaces, `#2563eb` Electric Blue CTAs). A 256px sidebar (collapses to 48px icon strip on mobile) provides navigation and sign-out on every authenticated screen. Submitted photos display full-width at the card top (aspect-video ratio), not as 64×64 thumbnails. Submissions render in a responsive 1→2→3 column grid; follow-up threads are revealed via a count badge accordion. Geist + JetBrains Mono replace Inter.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Sidebar shell location | Add to `_protected.tsx` | It already wraps all authenticated routes — natural fit | Plan |
| Dark mode strategy | Dark-only; remove all `dark:` variants | Stitch design is dark-only; removing `dark:` halves class count | Plan |
| Font | Geist + JetBrains Mono via Google Fonts | Specified in Stitch design system | Research (Stitch MCP) |
| Component library | Raw Tailwind v4 + CSS custom properties | Zero deps; Stitch HTML output is pure CSS — maps directly | Plan |
| Photo display | Full-width `aspect-video`, flush to card top | Matches Stitch "Photo > Reflection > Metadata > Actions" hierarchy | Research (Stitch MCP) |
| Sidebar mobile | Collapse to 48px icon-only strip at < 1024px | Always visible; no overlay/drawer state needed | Plan |
| File structure | Split `challenges.tsx` into 3 component files | We're rewriting every line anyway; split adds near-zero cost | Plan |
| Submission layout | 3-column responsive grid; follow-ups in accordion | Matches Stitch design; threading via count badge is cleaner in a grid | Plan |

## Scope

**In scope:**
- `app/app.css` — full token system overhaul
- `app/root.tsx` — font swap + loading/error state styles
- `app/routes/_protected.tsx` — sidebar shell
- `app/routes/login.tsx` — full restyle
- `app/routes/challenges.tsx` — slim to imports only
- `app/routes/challenges.new.tsx` — form restyle
- `app/components/RejectionScreen.tsx` — full restyle
- `app/components/Sidebar.tsx` — new file
- `app/components/ChallengeCard.tsx` — extracted + redesigned
- `app/components/SubmissionCard.tsx` — extracted + redesigned
- `app/components/SubmissionList.tsx` — extracted + redesigned (grid)
- `app/welcome/` — deleted (dead code)

**Out of scope:**
- Firebase, Firestore, auth logic — untouched
- Light mode support
- New features (EXIF display, invite links, etc.)
- shadcn/ui or any component library

## Architecture / Approach

Pure visual layer swap using Tailwind v4 CSS custom properties. All Stitch color/radius/font tokens are registered in `app.css @theme`, making them first-class Tailwind class names (e.g. `bg-bg-surface`, `text-text-primary`, `rounded-card`). The sidebar lives in `_protected.tsx` as a flex layout wrapper. The submission grid uses standard CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) — no JS grid library needed. Follow-up threading changes from a recursive indent tree to a per-card `showFollowUps` toggle that reveals a flat single-column accordion below each root card.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Design tokens + fonts | All Stitch color/type/radius tokens in `@theme`; Geist loaded | Token class names must be used consistently from this point — any raw hex later is drift |
| 2. Sidebar nav shell | 256px sidebar + responsive collapse; sign-out wired | `_protected.tsx` layout change breaks if Outlet doesn't fill remaining space correctly |
| 3. Auth screens | Login + rejection screen fully styled; root loading states fixed | None significant — these are isolated components |
| 4. Card redesign + extraction | Photos full-width; 3-col grid; follow-up accordion; 3 new component files | Grid + accordion pattern is the most novel code — the `col-span-full` follow-up panel trick needs testing |
| 5. Route cleanup | `challenges.tsx` slimmed; form restyled; dead code deleted | Low risk — mainly imports and class name updates |

**Prerequisites:** Stitch MCP active (already confirmed), Tailwind v4 already installed  
**Estimated effort:** ~3–4 focused sessions across 5 phases

## Open Risks & Assumptions

- Geist is available on Google Fonts — if not, use the `geist` npm package (`npm install geist`) and import its CSS directly
- The `col-span-full` accordion trick for follow-ups requires the follow-up panel to be a direct sibling of the grid item inside the same grid container — if the DOM structure resists this, fall back to a full-width row below the card using a separate `<div className="col-span-full">` rendered conditionally in `SubmissionList`
- No existing tests cover UI rendering — all verification is manual + type-check

## Success Criteria (Summary)

- Full MVP flow (sign in → submit → follow-up → comment) works end-to-end in the new design
- No `bg-blue-600`, `dark:`, or inline `style={{` remain anywhere in `app/`
- `challenges.tsx` is under 80 lines (confirms extraction happened)
