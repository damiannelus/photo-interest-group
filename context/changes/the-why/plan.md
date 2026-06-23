# The Why — Implementation Plan

## Overview

Add a "The Why" entry to the sidebar navigation that links to a public, standalone page displaying the creator's motivation text. The page is accessible pre-login (outside the protected layout).

## Current State Analysis

The sidebar (`app/components/Sidebar.tsx`) has two nav items — Feed and New Challenge — both wrapped in the protected layout. There are no informational pages, no modal/drawer infrastructure, and no unprotected routes beyond `/login`. All content is gated behind Firebase auth + whitelist check.

## Desired End State

A third nav entry appears at the top of the sidebar (above Feed) with an info-circle icon and the label "The Why". Clicking it navigates to `/why`, a standalone public page with the Polish motivation text. The page includes a "← Back" link to `/`. No authentication is required to view it.

### Key Discoveries

- `app/components/Sidebar.tsx:76-85` — nav items section; new entry goes at the top inside `<div className="flex flex-col gap-1 p-2 flex-1">`
- `app/routes.ts:1-9` — route config; `/why` must be declared outside the `layout("routes/_protected.tsx", [...])` block
- `app/routes/login.tsx` — reference for standalone (no-sidebar) page structure
- No icon matching "info" exists yet; a new `InfoIcon` SVG component is needed

## What We're NOT Doing

- No sidebar on the `/why` page — it's a standalone public page, consistent with `/login`
- No translation — content stays in Polish as authored in `context/the-why.md`
- No auth-conditional rendering on the page itself
- No back-navigation awareness (no `useNavigate(-1)`) — a static link to `/` is sufficient

## Implementation Approach

Two files change: `routes.ts` (register route) and `Sidebar.tsx` (add icon + link). One file is created: `routes/why.tsx`. The page reuses existing design tokens; no new CSS or component infrastructure is needed.

---

## Phase 1: The Why page

### Overview

Create the standalone `/why` page and register it as an unprotected route.

### Changes Required

#### 1. Route registration

**File**: `app/routes.ts`

**Intent**: Register `/why` as a public route, outside the protected layout, so it renders without the sidebar and without the auth guard.

**Contract**: Add `route("why", "routes/why.tsx")` as a sibling of `route("login", ...)`, before the `layout(...)` block.

#### 2. Page component

**File**: `app/routes/why.tsx` (new file)

**Intent**: Render the motivation text in a clean, single-column reading layout with a "← Back" link to `/`.

**Contract**: No loader, no action, no auth dependency. The component exports a default function. Layout uses the same design tokens as the rest of the app (`bg-bg`, `text-text-primary`, `text-text-secondary`, `border-border`). Structure: centered content column, "← Back" link at top, three paragraphs of Polish text. Content comes from the text in `context/the-why.md` — copy it verbatim.

### Success Criteria

#### Automated Verification

- Type check passes: `npm run typecheck`
- Build passes: `npm run build`

#### Manual Verification

- Navigating to `http://localhost:5173/why` renders the page without requiring login
- The three paragraphs of Polish text are visible
- The "← Back" link navigates to `/`
- Page uses the correct dark design tokens (consistent with the rest of the app)

**Implementation Note**: After completing this phase and automated verification passes, confirm the page renders correctly before proceeding to Phase 2.

---

## Phase 2: Sidebar entry

### Overview

Add an info-circle icon and a "The Why" nav link to the top of the sidebar nav section.

### Changes Required

#### 1. InfoIcon component

**File**: `app/components/Sidebar.tsx`

**Intent**: Add an inline SVG info-circle icon that follows the same pattern as `GridIcon` and `PlusIcon` — 20×20, stroke-only, `aria-hidden="true"`.

**Contract**: SVG uses a circle + lowercase "i" mark (circle at cx=12 cy=12 r=10; dot at cx=12 cy=8; vertical line from cy=12 to cy=16). Matches existing icon sizing and stroke style.

#### 2. Nav link

**File**: `app/components/Sidebar.tsx:76-85`

**Intent**: Add `<NavLink to="/why">` as the first item inside the nav section, above the Feed link, using the existing `navLinkClass` function for active/inactive styling.

**Contract**: Structure mirrors the existing Feed and New Challenge links — `<NavLink to="/why" end className={navLinkClass}><InfoIcon /><span className="hidden lg:block">The Why</span></NavLink>`. The `end` prop prevents it from matching as active on sub-paths.

### Success Criteria

#### Automated Verification

- Type check passes: `npm run typecheck`

#### Manual Verification

- The sidebar shows a third icon above Feed (icon-only on mobile, icon + "The Why" label on lg:)
- Clicking the entry in the sidebar navigates to `/why`
- The entry highlights as active when on `/why` and is inactive when on any other route
- Feed and New Challenge links are unaffected

**Implementation Note**: After this phase, manually verify both mobile (icon-only) and desktop (icon + label) sidebar states.

---

## Testing Strategy

### Manual Testing Steps

1. Open the app while logged out — navigate directly to `/why` — confirm the page renders without an auth error
2. Log in — confirm "The Why" appears at the top of the sidebar above Feed
3. Click "The Why" in the sidebar — confirm navigation to `/why` and active highlight
4. Click "← Back" on the page — confirm navigation to `/` (feed)
5. On mobile viewport — confirm icon-only sidebar shows the info icon as first nav item
6. On desktop — confirm "The Why" label renders correctly alongside the icon

## References

- Motivation text source: `context/the-why.md`
- Sidebar to modify: `app/components/Sidebar.tsx`
- Route config: `app/routes.ts`
- Standalone page reference: `app/routes/login.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The Why page

#### Automated

- [x] 1.1 Type check passes: `npm run typecheck`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [ ] 1.3 `/why` renders without login
- [ ] 1.4 Polish text is visible (three paragraphs)
- [ ] 1.5 "← Back" navigates to `/`
- [ ] 1.6 Design tokens are consistent with the rest of the app

### Phase 2: Sidebar entry

#### Automated

- [ ] 2.1 Type check passes: `npm run typecheck`

#### Manual

- [ ] 2.2 Info icon appears above Feed in sidebar
- [ ] 2.3 Clicking navigates to `/why` with active highlight
- [ ] 2.4 Mobile (icon-only) and desktop (icon + label) both render correctly
- [ ] 2.5 Feed and New Challenge links are unaffected
