# The Why — Plan Brief

> Full plan: `context/changes/the-why/plan.md`

## What & Why

Add a "The Why" entry to the sidebar that links to a public, standalone page with the creator's motivation text. The text already exists in `context/the-why.md` — the work is purely UI wiring. The goal is to give members (and prospective members who have the URL) access to the story behind the app before or after login.

## Starting Point

The sidebar today has two nav items — Feed and New Challenge — both inside the protected layout. There are no informational pages and no unprotected routes beyond `/login`. No icon or page for this content exists yet.

## Desired End State

A third sidebar entry — info-circle icon, label "The Why" — sits at the top of the nav section above Feed. Clicking it navigates to `/why`, a clean single-column standalone page (no sidebar) with the Polish motivation text and a "← Back" link. The page is publicly accessible without login.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Presentation | New route `/why` | Clean reading experience, deep-linkable, consistent with how `/challenges/new` works | Plan |
| Auth scope | Public (pre-login) | A prospective member receiving the link should be able to read it without a whitelist account | Plan |
| Sidebar placement | Top of nav, above Feed | User preference — highest visibility for new members | Plan |
| Icon | Info circle (ⓘ) | Standard universal convention for informational / about content | Plan |
| Page layout | Standalone (no sidebar) | `/why` is public, so it can't be inside the protected layout; consistent with `/login` | Plan |

## Scope

**In scope:**
- New `app/routes/why.tsx` — standalone public page with Polish motivation text
- Register `/why` in `app/routes.ts` outside the protected layout
- `InfoIcon` SVG + `<NavLink to="/why">` in `Sidebar.tsx`, above Feed

**Out of scope:**
- Translation to English
- Auth-conditional rendering on the page
- Sidebar navigation on the `/why` page itself
- Any modal, drawer, or overlay infrastructure

## Architecture / Approach

Two existing files change (`routes.ts`, `Sidebar.tsx`), one new file is created (`routes/why.tsx`). The page reuses existing design tokens — no new CSS or components beyond the inline SVG icon. The route sits alongside `/login` as an unprotected sibling outside the protected layout block.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. The Why page | Public `/why` route renders the motivation text | Design token consistency with the dark-mode app |
| 2. Sidebar entry | Info icon + nav link at top of sidebar | Active-state highlight should not bleed to other routes |

**Prerequisites:** None — no dependencies on in-progress work.  
**Estimated effort:** ~1 short session across 2 phases.

## Open Risks & Assumptions

- The "← Back" link hardcodes `/` — if a logged-out user follows it, they land on the feed route which redirects them to `/login`. This is acceptable; no back-navigation awareness needed.
- Content is copied verbatim from `context/the-why.md` — no translation or editing required.

## Success Criteria (Summary)

- `/why` is reachable without login and displays the full Polish text
- The sidebar shows "The Why" at the top of the nav section on all screen sizes
- All existing sidebar links and routes remain unaffected
