# UI Rebuild — Stitch "High-Utility Technical Minimalism" Implementation Plan

## Overview

Replace the app's entire visual layer to match the Stitch design system: deep dark-only palette, Geist font, 256px collapsible sidebar navigation, full-width photo cards, and a responsive 3-column submission grid. All Firebase/Firestore business logic is unchanged — this is a pure visual and layout transformation.

## Current State Analysis

- **Routes**: 4 files. `challenges.tsx` + `challenges.new.tsx` are Tailwind-styled (blue-600 CTAs, gray-900 palette). `login.tsx` + `_protected.tsx` are bare inline-style HTML.
- **Components**: `RejectionScreen.tsx` uses inline styles. `welcome.tsx` is dead React Router scaffold code.
- **CSS surface**: `app.css` has 3 effective rules — Tailwind v4 import, Inter `@theme`, and a light/dark body background. No custom utility classes exist.
- **Dark mode**: currently `prefers-color-scheme` driven with `dark:` variants on every class.
- **Layout**: `max-w-2xl mx-auto` centered column — no sidebar, no persistent nav, no sign-out affordance in the app.
- **Submissions**: 64×64 thumbnail + text side-by-side; follow-up threading uses a recursive indent tree (max depth 3).

## Desired End State

The app renders exclusively in dark mode. A 256px sidebar (collapses to 48px icon strip at < 1024px) provides navigation and user context on every authenticated screen. Challenge cards display the submitted photo full-width at the top (aspect-video), with reflection, metadata, and actions stacked below. Submissions within a challenge render in a 1→2→3 column responsive grid; follow-ups are revealed via a count badge accordion on each root card. Login and rejection screens are fully styled with the new tokens. No `dark:` Tailwind variants remain in the codebase.

### Key Discoveries

- Stitch design system name: **"High-Utility Technical Minimalism"** — Linear/Vercel aesthetic, dark-only, photography-focused (`research.md`)
- Font: **Geist** (replaces Inter) + **JetBrains Mono** for timestamps/metadata (`research.md`)
- Color tokens are explicit in the Stitch project's `designMd` — exact hex values extracted
- `_protected.tsx` is the correct place for the sidebar shell — it already wraps all authenticated routes (`app/routes/_protected.tsx:1–14`)
- `challenges.tsx` is 738 lines; all three components (`ChallengeCard`, `SubmissionCard`, `SubmissionList`) must be extracted — we're rewriting every line anyway
- The `buildSubmissionTree` utility returns a `Map<string|null, Submission[]>` that already separates roots from children — the new grid renderer can consume it without any data-layer changes (`app/lib/submissionTree.ts`)
- `welcome.tsx` is imported by no route — safe to delete (`app/welcome/welcome.tsx`)

## What We're NOT Doing

- No changes to Firebase, Firestore queries, auth, or data models
- No light mode — dark-only; no toggle
- No component library (shadcn/ui, DaisyUI) — raw Tailwind v4 only
- No changes to routing structure beyond updating `_protected.tsx` JSX
- No new functionality (invite links, EXIF display, etc.)
- No redesign of the `challenges.new.tsx` submission form flow — restyle only
- No mobile submission grid (single column on mobile is the grid's collapsed state)

## Implementation Approach

Five sequential phases, each independently verifiable. Phase 1 lays the token foundation; all later phases consume those tokens. Phase 2 adds the sidebar shell. Phases 3–5 restyle components top-to-bottom. The `dark:` variant removal happens as a byproduct of each phase rewriting its files — not as a separate sweep.

**Token naming convention** (Tailwind v4 `@theme` CSS custom properties → class names):
- `--color-bg-base` → `bg-bg-base` (body/html background)
- `--color-bg-surface` → `bg-bg-surface` (cards, panels)
- `--color-bg-elevated` → `bg-bg-elevated` (hover states, menus)
- `--color-bg-sidebar` → `bg-bg-sidebar` (sidebar background)
- `--color-text-primary` → `text-text-primary` (primary text)
- `--color-text-secondary` → `text-text-secondary` (muted text)
- `--color-text-faint` → `text-text-faint` (placeholder, tertiary)
- `--color-accent` → `bg-accent`, `text-accent` (Electric Blue #2563eb — CTAs, focus rings)
- `--color-accent-dim` → `text-accent-dim` (primary-muted #b4c5ff — links, active nav)
- `--color-border` → `border-border` (1px borders, outline-variant #434655)
- `--color-border-strong` → `border-border-strong` (focused borders, outline #8d90a0)
- `--color-error` → `text-error`, `bg-error` (error text #ffb4ab / error container #93000a)
- `--color-success` → `text-success` (#b4c5ff — reuse accent-dim for "threshold met" state)

## Critical Implementation Details

**Follow-up threading in grid context**: The new `SubmissionList` renders only root submissions (`byParent.get(null)`) in the CSS grid. For each root card, children are fetched from `byParent.get(submission.id)`. A "N follow-ups" badge triggers a `useState` toggle that renders a single-column nested `<div>` spanning the full grid row below the card (achieved with `col-span-full` on a sibling element inside a CSS subgrid or a flat DOM trick). The `depth > 3` guard in the old recursive renderer is no longer needed — follow-ups only render one level deep in the accordion (follow-ups of follow-ups are shown inside the accordion, still as a flat list capped at the same `byParent` data).

**Sidebar sign-out**: `Sidebar.tsx` needs both `useAuth` (for `user.email`) and `useNavigate` + Firebase `signOut`. Import `auth` from `~/firebase` directly — don't thread a sign-out handler through props.

**Tailwind v4 border-radius registration**: Tailwind v4 uses `--radius-*` namespace for border radii in `@theme`. Register as `--radius-card: 1rem` etc. so `rounded-card` becomes a valid class.

---

## Phase 1: Design Tokens + Fonts

### Overview

Establish the entire token foundation in `app.css` and swap the font load in `root.tsx`. Every subsequent phase will use these token class names — no phase should introduce a raw hex value inline.

### Changes Required

#### 1. Tailwind @theme — color, font, radius tokens

**File**: `app/app.css`

**Intent**: Replace the Inter font declaration and the `bg-white dark:bg-gray-950` body rule with the full Stitch token set. Remove the `prefers-color-scheme` media query — the app is now unconditionally dark.

**Contract**: The `@theme` block must register all tokens listed in the "Token naming convention" above, plus border-radius aliases (`--radius-card: 1rem`, `--radius-input: 0.5rem`, `--radius-badge: 9999px`) and font family vars (`--font-sans: "Geist"`, `--font-mono: "JetBrains Mono"`). The `html, body` rule sets `background-color` to `var(--color-bg-base)` and `color` to `var(--color-text-primary)` unconditionally — no `@media` wrapper.

Token values (from Stitch `designMd`):
```
--color-bg-base:      #11131b   (surface / background)
--color-bg-surface:   #1d1f27   (surface-container)
--color-bg-elevated:  #282a32   (surface-container-high)
--color-bg-sidebar:   #191b23   (surface-container-low)
--color-text-primary: #e1e2ed   (on-surface)
--color-text-secondary:#c3c6d7  (on-surface-variant)
--color-text-faint:   #8d90a0   (outline)
--color-accent:       #2563eb   (primary-container / Electric Blue)
--color-accent-dim:   #b4c5ff   (primary)
--color-border:       #434655   (outline-variant)
--color-border-strong:#8d90a0   (outline)
--color-error:        #ffb4ab   (error)
--color-error-bg:     #93000a   (error-container)
--color-success:      #b4c5ff   (reuse accent-dim for counter threshold)
```

#### 2. Font loading

**File**: `app/root.tsx`

**Intent**: Replace the Inter Google Fonts `<link>` tags with Geist and JetBrains Mono. Keep the `preconnect` links.

**Contract**: The `links` export returns four link tags: two `preconnect` tags (same as now), one stylesheet link for Geist (`family=Geist:wght@100..900`), and one for JetBrains Mono (`family=JetBrains+Mono:wght@400;600`). Both use `display=swap`.

### Success Criteria

#### Automated Verification
- `npm run typecheck` passes — no TS errors from the CSS changes
- `npm run build` succeeds — Tailwind v4 compiles without unknown token warnings

#### Manual Verification
- Open the app — body background is `#11131b`, not white or gray
- Text on any page is `#e1e2ed` (near-white), not black
- Font on any page renders Geist, not Inter (check DevTools → Computed → font-family)
- No light mode appearance when system preference is set to light

**Implementation Note**: Pause after Phase 1 manual verification before proceeding.

---

## Phase 2: App Shell — Sidebar Nav

### Overview

`_protected.tsx` becomes the full-page layout shell. A new `Sidebar` component renders the left nav column. The `<Outlet>` becomes the right/main content area.

### Changes Required

#### 1. Sidebar component

**File**: `app/components/Sidebar.tsx` *(new file)*

**Intent**: Render the 256px fixed sidebar with the app logo/name, two nav links (Feed, New Challenge), and a user info + sign-out block at the bottom. On screens < 1024px (`lg` breakpoint) the sidebar collapses to a 48px wide icon-only strip — labels are hidden via `lg:block hidden`.

**Contract**: The component uses `useAuth` for `user.email` and `useNavigate` + Firebase `signOut` for the sign-out action. Nav items use React Router `<NavLink>` with `className` callback to apply `text-accent-dim` on the active route. The root `<nav>` element is `w-12 lg:w-64` (48px collapsed / 256px expanded) with `bg-bg-sidebar border-r border-border h-screen sticky top-0 flex flex-col` — always visible, no drawer/overlay needed.

Nav items:
| Icon | Label | Route |
|------|-------|-------|
| Grid SVG | Feed | `/` |
| Plus SVG | New Challenge | `/challenges/new` |

Bottom area: user email truncated (hidden on mobile), "Sign out" ghost button.

#### 2. Protected layout shell

**File**: `app/routes/_protected.tsx`

**Intent**: Wrap the authenticated app in a two-column flex layout: `<Sidebar>` on the left, `<Outlet>` filling the remaining space on the right.

**Contract**: The root element is `<div className="flex min-h-screen bg-bg-base">`. Loading and rejection states get basic styled fallbacks using the new tokens (replace bare `<div>Loading…</div>` with a centered spinner using `text-text-secondary`).

### Success Criteria

#### Automated Verification
- `npm run typecheck` passes
- `npm run build` succeeds

#### Manual Verification
- Authenticated app shows a 256px dark sidebar on desktop
- Sidebar collapses to 48px icon strip at < 1024px viewport width
- Active nav item is highlighted in `#b4c5ff`
- Sign-out from sidebar redirects to `/login`
- Loading state is styled (not a bare white div)

**Implementation Note**: Pause after Phase 2 manual verification before proceeding.

---

## Phase 3: Auth Screens + Root Loading States

### Overview

Restyle the three currently unstyled surfaces: the login page, rejection screen, and the root-level loading/error states.

### Changes Required

#### 1. Login page

**File**: `app/routes/login.tsx`

**Intent**: Replace all inline `style={{...}}` with Tailwind utility classes using the new tokens. The page should be a full-screen centered card (no sidebar — this route is outside `_protected.tsx`).

**Contract**: The outer div uses `min-h-screen bg-bg-base flex items-center justify-center`. The inner card is `bg-bg-surface border border-border rounded-card p-10 w-full max-w-sm flex flex-col items-center gap-6`. The "Sign in with Google" button uses `bg-accent text-white text-sm font-medium px-5 py-2.5 rounded-input hover:opacity-90 transition-opacity`. App name as `headline-sm` (18px) above the button.

#### 2. Rejection screen

**File**: `app/components/RejectionScreen.tsx`

**Intent**: Same approach as login — replace inline styles with new-token Tailwind classes. Full-screen dark centered layout with the rejection message and a "Sign Out" secondary button.

**Contract**: Mirror the login page layout. "Sign Out" uses the secondary button style: `border border-border text-text-secondary px-4 py-2 rounded-input hover:bg-bg-elevated text-sm`.

#### 3. Root loading + error states

**File**: `app/root.tsx`

**Intent**: Replace the bare `<div>Loading…</div>` `HydrateFallback` and improve the `ErrorBoundary` to use new tokens.

**Contract**: `HydrateFallback` returns a `min-h-screen bg-bg-base flex items-center justify-center` div with a simple `text-text-secondary text-sm` "Loading…" text. `ErrorBoundary` keeps its current structure but applies `bg-bg-base text-text-primary` to the `<main>` container.

### Success Criteria

#### Automated Verification
- `npm run typecheck` passes

#### Manual Verification
- `/login` page renders as a centered dark card with a styled blue "Sign in with Google" button
- Rejection screen renders with correct dark styling and a bordered "Sign Out" button
- No inline `style={{}}` remain in `login.tsx` or `RejectionScreen.tsx`

**Implementation Note**: Pause after Phase 3 manual verification before proceeding.

---

## Phase 4: Component Extraction + Card Redesign

### Overview

Extract the three inline components from `challenges.tsx` into separate files and redesign them with the new visual language. This is the largest phase — the most design-significant changes happen here.

### Changes Required

#### 1. SubmissionCard component

**File**: `app/components/SubmissionCard.tsx` *(new file — extract from `challenges.tsx:26–453`)*

**Intent**: Move `SubmissionCard` into its own file and redesign the layout. The photo becomes a full-width `aspect-video` image at the top of the card, flush to the card edges. Below it: author email (`label-caps` style), reflection text (`body-md`), action bar (Comments count, Follow-Up, Edit, Delete). Inline forms (comment, follow-up, edit reflection) sit below the action bar, toggled by the same boolean state as before.

**Contract**: 
- Card wrapper: `bg-bg-surface border border-border rounded-card overflow-hidden` (overflow-hidden ensures the flush photo respects the card's border-radius)
- Photo: `<img className="w-full aspect-video object-cover" />` — no padding, no margin, flush to card top
- Content area below photo: `p-4 flex flex-col gap-3`
- Author email: `text-xs font-semibold tracking-widest uppercase text-text-faint` (label-caps style)
- Reflection text: `text-sm text-text-secondary leading-5`
- Action buttons: ghost style — `text-xs text-text-faint hover:text-text-primary transition-colors`; "Follow-Up" uses `text-accent-dim hover:text-accent`
- Inline forms: input/textarea use `bg-bg-base border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent`
- Character counter "threshold met" state: `text-success text-xs` instead of `text-green-600`
- Primary submit buttons in forms: `bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-input disabled:opacity-40`

#### 2. SubmissionList component

**File**: `app/components/SubmissionList.tsx` *(new file — replace `challenges.tsx:460–486`)*

**Intent**: Replace the recursive indent-tree renderer with a responsive CSS grid. Root submissions render in a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` layout. Each `SubmissionCard` receives a `childSubmissions` prop (the `byParent.get(submission.id) ?? []` slice); the card renders a "↩ N follow-ups" accordion toggle at the bottom if children exist.

**Contract**:
- Props: `{ rootSubmissions: Submission[], byParent: Map<string | null, Submission[]> }`
- The root `<div>` uses `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Each grid item renders `<SubmissionCard submission={sub} childSubmissions={byParent.get(sub.id) ?? []} />`
- `SubmissionCard` receives `childSubmissions: Submission[]`; if `childSubmissions.length > 0`, a "↩ {n} follow-up{s}" ghost button appears in the action bar; clicking toggles `showFollowUps` state
- When `showFollowUps` is true, a `col-span-full` sibling div (wrapping with a separate fragment or a wrapper div) renders the follow-up cards in a single-column `flex flex-col gap-3` list — these are second-level submissions only (not recursed further), applying a `border-l-2 border-border ml-4 pl-4` indent to signal hierarchy
- The `depth` parameter and recursive `SubmissionList` call from the old implementation are removed

**Note on DOM structure**: To make follow-ups span the full grid row, the grid items and their follow-up panels need to be siblings inside the grid. Use a wrapper pattern: each root submission renders as a `<div key={sub.id} className="contents">` with two children — the `SubmissionCard` div (which gets `col-span-1`) and the follow-up panel div (which gets `col-span-full`, hidden when `showFollowUps` is false). This requires the `showFollowUps` state to live in a thin wrapper, not in `SubmissionCard` itself. Alternatively, manage the toggle in `SubmissionList` with a `Set<string>` of expanded IDs.

#### 3. ChallengeCard component

**File**: `app/components/ChallengeCard.tsx` *(new file — extract from `challenges.tsx:492–687`)*

**Intent**: Move `ChallengeCard` to its own file. Restyle the card header, description, submission count, and the inline submission form with new tokens.

**Contract**:
- Card wrapper: `bg-bg-surface border border-border rounded-card p-6 flex flex-col gap-5`
- Challenge title: `text-lg font-semibold text-text-primary tracking-tight` (headline-sm style)
- "Submit Photo" button: `bg-accent text-white text-sm font-medium px-4 py-2 rounded-input hover:opacity-90`; when form open, a ghost "Cancel" link
- Description: `text-sm text-text-secondary`
- Submission count label: `text-xs font-semibold tracking-widest uppercase text-text-faint` (label-caps)
- Inline submission form: same input/button token pattern as `SubmissionCard` forms
- Character counter: same `text-success` pattern
- Imports `SubmissionList` from `~/components/SubmissionList`

### Success Criteria

#### Automated Verification
- `npm run typecheck` passes — all new component files type-check; no broken imports
- `npm run build` succeeds

#### Manual Verification
- Challenge feed shows cards with full-width aspect-video photo thumbnails
- Submission grid is 3 columns on desktop (≥ 1024px), 2 on tablet, 1 on mobile
- "↩ N follow-ups" badge appears on cards with follow-ups; clicking reveals a single-column follow-up list
- Character counter turns `text-success` color when threshold is met
- No `w-16 h-16` thumbnails remain
- `app/components/` contains `ChallengeCard.tsx`, `SubmissionCard.tsx`, `SubmissionList.tsx`

**Implementation Note**: Pause after Phase 4 manual verification before proceeding.

---

## Phase 5: Route Cleanup

### Overview

Slim the route files down to imports + page-level layout. Restyle the `challenges.new.tsx` form. Delete dead code.

### Changes Required

#### 1. Challenge feed route

**File**: `app/routes/challenges.tsx`

**Intent**: Remove the three extracted component definitions (they now live in `app/components/`). The route file keeps only `ChallengeFeed` (the default export) and its imports. Update the page wrapper `max-w-2xl` to `max-w-screen-xl mx-auto py-8 px-8` to accommodate the wider grid.

**Contract**: The file shrinks from ~738 lines to ~50. It imports `ChallengeCard` from `~/components/ChallengeCard`. The page header title uses `headline-lg` sizing (`text-2xl font-semibold text-text-primary tracking-tight`). The "+ New Challenge" link uses the primary button style.

#### 2. New challenge form

**File**: `app/routes/challenges.new.tsx`

**Intent**: Replace all blue-600/gray Tailwind classes with new token classes. No structural change to the form.

**Contract**: Same layout (`max-w-2xl mx-auto py-8 px-4`), input/button/label classes updated to match Phase 4 form patterns. "Create Challenge" button uses `bg-accent`. "Back to challenges" and "Cancel" links use `text-text-secondary hover:text-text-primary`.

#### 3. Dead code removal

**File**: `app/welcome/welcome.tsx` + `app/welcome/logo-dark.svg` + `app/welcome/logo-light.svg`

**Intent**: Delete the entire `app/welcome/` directory — it is imported by no route and serves no purpose.

**Contract**: Confirm with `grep -r "from.*welcome"` that no file imports from `~/welcome` before deleting.

### Success Criteria

#### Automated Verification
- `npm run typecheck` passes
- `npm run build` succeeds — no dead import warnings
- `grep -r "welcome" app/` returns no matches

#### Manual Verification
- Full MVP user flow works end-to-end: sign in → feed → submit photo → follow-up → comment
- `challenges.tsx` is under 80 lines
- No `bg-blue-600`, `dark:`, or inline `style={{` strings remain anywhere in `app/`

**Implementation Note**: After this final phase passes, the redesign is complete.

---

## Testing Strategy

### Automated
- `npm run typecheck` — TypeScript compilation after each phase
- `npm run build` — Vite build + Tailwind v4 compilation; catches unknown class names and broken imports

### Manual Testing Steps
1. Sign in with Google → login card renders correctly (dark, centered, Geist font)
2. Whitelist check → rejected user sees rejection screen (dark, styled)
3. Authenticated → sidebar visible at 256px with correct nav items and user email
4. Resize to < 1024px → sidebar collapses to 48px icon strip
5. Navigate to "New Challenge" via sidebar → form renders correctly
6. Create a challenge → appears in feed
7. Submit a photo to a challenge → full-width aspect-video photo in grid card
8. Submit a second photo → 2-column grid appears
9. Submit a follow-up → "↩ 1 follow-up" badge appears; click expands accordion
10. Post a comment → comment form opens, posts successfully
11. Edit a reflection → edit form opens, saves successfully
12. Delete a submission → card disappears from grid
13. Sign out via sidebar → redirects to login

## References

- Research doc: `context/changes/ui-rebuilt-to-match-stitch-redesigned-system/research.md`
- Stitch project: `https://stitch.withgoogle.com/projects/13887700268175041411`
- Design system spec: Stitch screen "Design Specification (DESIGN.md)" in the same project
- Submission tree utility: `app/lib/submissionTree.ts`
- Gate predicates (no changes needed): `app/lib/gatePredicates.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Design Tokens + Fonts

#### Automated
- [x] 1.1 `npm run typecheck` passes after `app.css` + `root.tsx` changes — ecab9bc
- [x] 1.2 `npm run build` succeeds — Tailwind v4 compiles all new token classes — ecab9bc

#### Manual
- [x] 1.3 Body background is `#11131b` (dark), not white — ecab9bc
- [x] 1.4 Font renders as Geist in DevTools — ecab9bc
- [x] 1.5 App remains dark when system preference is light — ecab9bc

### Phase 2: App Shell — Sidebar Nav

#### Automated
- [x] 2.1 `npm run typecheck` passes — 3a2e81f
- [x] 2.2 `npm run build` succeeds — 3a2e81f

#### Manual
- [x] 2.3 256px sidebar visible on desktop (≥ 1024px) — 3a2e81f
- [x] 2.4 Sidebar collapses to 48px icon strip at < 1024px — 3a2e81f
- [x] 2.5 Active nav item highlighted in `#b4c5ff` — 3a2e81f
- [x] 2.6 Sign-out via sidebar redirects to `/login` — 3a2e81f
- [x] 2.7 Loading state is styled (no bare white div) — 3a2e81f

### Phase 3: Auth Screens + Root Loading States

#### Automated
- [x] 3.1 `npm run typecheck` passes

#### Manual
- [x] 3.2 `/login` renders as centered dark card with styled blue button
- [x] 3.3 Rejection screen renders correctly with bordered "Sign Out" button
- [x] 3.4 No inline `style={{}}` remain in `login.tsx` or `RejectionScreen.tsx`

### Phase 4: Component Extraction + Card Redesign

#### Automated
- [ ] 4.1 `npm run typecheck` passes — all new component files type-check
- [ ] 4.2 `npm run build` succeeds

#### Manual
- [ ] 4.3 Submission photos display at full-width aspect-video ratio
- [ ] 4.4 Grid is 3 cols desktop / 2 cols tablet / 1 col mobile
- [ ] 4.5 "↩ N follow-ups" badge appears and accordion works
- [ ] 4.6 Character counter turns accent-dim color at threshold
- [ ] 4.7 No `w-16 h-16` thumbnails remain anywhere

### Phase 5: Route Cleanup

#### Automated
- [ ] 5.1 `npm run typecheck` passes
- [ ] 5.2 `npm run build` succeeds — no dead import warnings
- [ ] 5.3 `grep -r "welcome" app/` returns no matches

#### Manual
- [ ] 5.4 Full MVP flow works end-to-end (sign in → submit → follow-up → comment)
- [ ] 5.5 `challenges.tsx` is under 80 lines
- [ ] 5.6 No `bg-blue-600`, `dark:`, or inline `style={{` strings remain in `app/`
