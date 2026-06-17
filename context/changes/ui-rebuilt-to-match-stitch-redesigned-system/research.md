---
date: 2026-06-17T00:00:00+02:00
researcher: damiannelus
git_commit: 36cb79ca9dd4fc65d5b13ce0679feda71393b76c
branch: main
repository: photo-interest-group
topic: "UI rebuilt to match Stitch redesigned system"
tags: [research, codebase, ui, tailwind, components, stitch, design-system]
status: complete
last_updated: 2026-06-17
last_updated_by: damiannelus
---

# Research: UI rebuilt to match Stitch redesigned system

**Date**: 2026-06-17  
**Researcher**: damiannelus  
**Git Commit**: 36cb79ca9dd4fc65d5b13ce0679feda71393b76c  
**Branch**: main  
**Repository**: photo-interest-group

## Research Question

Map the current UI in full detail so the Stitch redesign can be applied cleanly. Target design: https://stitch.withgoogle.com/projects/13887700268175041411

## Summary

The app has 4 routes and 2 standalone components. The main feed (`challenges.tsx`) and new-challenge form (`challenges.new.tsx`) are well-styled with Tailwind v4. The login page and rejection screen are completely unstyled — they use inline `style={{}}` and raw `<button>` elements with zero Tailwind classes. There is no navigation header, no consistent loading skeleton, and no shared layout shell beyond the root `<Outlet>`.

The Stitch MCP was successfully added to the project config (`claude mcp add stitch ...`) but its tools are not loaded in the current session — a Claude Code restart is required before the Stitch design can be read via MCP tools.

## Detailed Findings

### Routes

| File | Route | Styling state |
|------|-------|---------------|
| `app/routes/login.tsx` | `/login` | Inline styles only — no Tailwind |
| `app/routes/_protected.tsx` | layout guard | Bare `<div>Loading…</div>` |
| `app/routes/challenges.tsx` | `/` (index) | Tailwind, most complete |
| `app/routes/challenges.new.tsx` | `/challenges/new` | Tailwind, consistent |

### Components

| File | Used by | Styling state |
|------|---------|---------------|
| `app/components/RejectionScreen.tsx` | `login.tsx`, `_protected.tsx` | Inline styles only — no Tailwind |
| `app/welcome/welcome.tsx` | Not used by any app route | React Router starter remnant — dead code |

### Current design language (from `challenges.tsx` + `challenges.new.tsx`)

**Layout**
- Page container: `max-w-2xl mx-auto py-8 px-4` — centred, 672 px max width
- Challenge card: `border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-white dark:bg-gray-900`
- Submission tree indent: `ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800` — max depth 3

**Color palette**
- Primary CTA: `bg-blue-600` / `hover:bg-blue-700`
- Body bg: `bg-white dark:bg-gray-950` (set in `app.css`)
- Card bg: `bg-white dark:bg-gray-900`
- Input bg: `bg-white dark:bg-gray-800`
- Border: `border-gray-200/300 dark:border-gray-600/700`
- Text primary: `text-gray-900 dark:text-gray-100`
- Text secondary: `text-gray-600/700 dark:text-gray-300/400`
- Text muted: `text-gray-400/500 dark:text-gray-500`
- Success counter: `text-green-600 dark:text-green-400`
- Error: `text-red-600 dark:text-red-400`
- Follow-up link: `text-blue-600 dark:text-blue-400`

**Typography**
- Font: Inter (Google Fonts, variable opsz 14–32, wt 100–900), set in `app.css` `@theme`
- Page `h1`: `text-2xl font-bold`
- Card `h2`: `text-xl font-semibold`
- Labels: `text-sm font-medium`
- Body / action links: `text-sm`
- Counters / secondary: `text-xs`

**Input fields** (uniform pattern across all forms)
```
border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2
text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800
placeholder-gray-400 dark:placeholder-gray-500
focus:outline-none focus:ring-2 focus:ring-blue-500
```

**Buttons**
- Primary: `bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded`
- Small primary (inline actions): `px-3 py-1.5 text-xs`
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- Ghost / cancel: plain text link with `hover:underline`

### Unstyled areas (priority targets for redesign)

1. **`app/routes/login.tsx:43–49`** — Entire page uses `style={{ display: 'flex', flexDirection: 'column', ... }}`. The `<button>Sign in with Google</button>` has no classes at all.

2. **`app/components/RejectionScreen.tsx:20–26`** — Same pattern: inline styles, bare unstyled button.

3. **`app/routes/_protected.tsx:9`** — `<div>Loading…</div>` with no style. Shown on every protected page load.

4. **`app/root.tsx:54`** — `<div>Loading…</div>` hydration fallback with no style.

5. **`app/root.tsx:75`** — Error boundary uses one Tailwind class (`pt-16 p-4 container mx-auto`) — inconsistent with card-based design.

6. **No navigation header** — There is no persistent nav bar, user avatar, or sign-out affordance anywhere in the app once logged in. Users currently have no way to sign out from within a protected page.

### CSS surface

- `app/app.css` — only 3 functional rules:
  1. `@import "tailwindcss"` (Tailwind v4 syntax)
  2. `@theme { --font-sans: "Inter" ... }` — registers Inter as the default sans stack
  3. `html, body { @apply bg-white dark:bg-gray-950 }` — base background

No custom utility classes, no `@layer components`, no CSS variables beyond the font. The entire design is Tailwind utility classes in JSX.

## Code References

- `app/app.css:1–16` — full CSS surface, Tailwind v4 import + theme
- `app/root.tsx:14–26` — font loading (Google Fonts link tags)
- `app/routes/login.tsx:43–49` — unstyled login page
- `app/components/RejectionScreen.tsx:20–26` — unstyled rejection screen
- `app/routes/_protected.tsx:9,11` — bare loading/rejection states
- `app/routes/challenges.tsx:553–686` — ChallengeCard JSX (the most design-complete component)
- `app/routes/challenges.tsx:697–737` — ChallengeFeed page root layout
- `app/routes/challenges.tsx:166–453` — SubmissionCard (inline form pattern, full Tailwind)
- `app/routes/challenges.new.tsx:41–121` — NewChallengePage (clean Tailwind form)

## Architecture Insights

- **Tailwind v4** is in use. The `@import "tailwindcss"` syntax in `app.css` means the v4 Vite plugin is wired up — no `tailwind.config.js` file is needed for basic usage. Custom tokens go in `@theme {}` blocks in CSS, not a JS config.
- **Dark mode** is system-preference driven (`prefers-color-scheme: dark`) — there is no manual toggle. Every component uses `dark:` variants.
- **No component library** — everything is hand-rolled Tailwind. The redesign can either stay with raw Tailwind or introduce a component library (shadcn/ui, DaisyUI, etc.) — the Stitch design will determine which is more appropriate.
- **welcome.tsx** is dead code from the React Router starter scaffold — safe to delete during the redesign.

## Stitch MCP Access

The Stitch MCP server was added via:
```
claude mcp add -t http stitch https://stitch.googleapis.com/mcp -H "X-Goog-Api-Key: <key>"
```
Config written to: `C:\Users\damia\.claude.json` (local scope for this project).

**Status: not loaded in current session.** MCP tools are loaded at Claude Code startup; the server was added after this session started. A Claude Code restart is required to get Stitch tools in the tool list. Once restarted, the Stitch project `13887700268175041411` can be read directly via MCP to extract design tokens, component specs, and layout specs — which will become the source of truth for the redesign plan.

## Open Questions

1. **Stitch design content**: What components does the Stitch design cover? Once the MCP loads after restart, read the project to extract exact specs (colors, typography scale, spacing, component inventory). This will determine whether to stay with raw Tailwind or adopt a component library.
2. **Navigation shell**: The Stitch design may introduce a persistent header. Where does sign-out live? Is there a user menu?
3. **Photo layout**: Current submission thumbnail is `w-16 h-16` (tiny). Does the Stitch design show larger photo cards or a gallery layout?
4. **welcome.tsx removal**: Confirm this is dead code and delete it as part of the cleanup pass.
