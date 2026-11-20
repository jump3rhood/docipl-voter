# Doc IPL Voting — Admin menu, team list and logo delivery (short design)

**Date:** 2026-11-20 · **Size:** small change (admin UI plus how logos are served) · **Approved by the user:** 2026-11-20

## Intent
The admin is used on a phone. The organiser wants:
- a cleaner admin with a slide-out hamburger menu
- a Teams page that is easy to scan and edit
- drag-to-reorder instead of typing display-order numbers
- logo upload (up to 1 MB) kept, but moved into the team editor

Expected turnout is about 10k voters, so logos must not be served straight from Supabase: the free download allowance would run out.

## Goals
- **Hamburger menu** on all protected admin pages.
- **Teams page** as a compact, drag-sortable list, with a slide-up editor per team and an "Add team" button that opens the same editor.
- **Logos:** upload stays (PNG, JPG or WEBP, at most 1 MB, stored in the existing Supabase `team-logos` bucket). Every page serves logos through Next's image optimizer on Vercel, so Supabase sends each original only a few times.

## Non-goals
- No changes to the voting pages' behaviour or look, beyond logos now being optimized.
- No vote logic, API or DB schema changes, and **no new migrations** (the user applies migrations by hand).
- No new admin pages.

## Anti-goals
- The ballot bundle grows (budget ≤196 KB gzipped, as measured in the motion work).
- A reorder silently loses or duplicates a team's position.
- A drag gesture on the phone scrolls the page instead of moving the row, or a normal scroll accidentally drags rows.

## Approaches considered
| | What | Trade-off |
|---|---|---|
| **A (chosen)** | `framer-motion` `Reorder` (already installed) for drag; logos via `next/image` optimization | No new dependency; admin chunk only |
| B | `@dnd-kit` for drag | Best keyboard support, but a new dependency for one list |
| C | Static logos in `public/` | No Supabase traffic, but the user wants admin upload |

An earlier idea (static logos named by slug in `public/`) was replaced: the user wants admins to upload logos.

## Design

### Hamburger menu (`src/app/admin/(protected)/layout.tsx`)
- A slim top bar shows the current page name and a ☰ button (`aria-label="Open menu"`, `aria-expanded`, `aria-controls`).
- The panel slides in from the left over a dimmed backdrop. It contains Dashboard, Voting, Teams, Results and a Log out button (the existing Server Action form). The current page has `aria-current="page"` and a highlight.
- It closes on: tapping a link, tapping the backdrop, the ✕ button, Escape, or a route change.
- While open: focus moves into the panel and stays there, body scroll is locked, and focus returns to ☰ on close.
- Reduced motion: it appears without sliding.

### Teams page (`src/app/admin/(protected)/teams/`)
- **Rows:** one compact row per team in display order. Each row has:
  - a ⠿ drag handle
  - the logo (or initials) at 40px
  - the name
  - a dot in the team's accent colour
  - a **Live** pill (active) or **Hidden** pill (inactive)
- **Reordering:**
  - Dragging starts only from the handle, with `touch-action: none` on the handle so the page still scrolls elsewhere.
  - Dropping saves the full new order at once, with positions 1..n in list order.
  - The row shows "Saving…" while it saves, then "Order saved"; on failure it shows the error and the list reverts.
  - Each row also has "Move up" and "Move down" buttons (visually small, keyboard and screen-reader accessible) that save the same way.
- **Editing:** tapping the row (outside the handle) opens a bottom-sheet editor (`role="dialog"`, `aria-modal`, focus trap, Escape and backdrop close unless saving), with:
  - a logo picker with an instant local preview (PNG/JPG/WEBP, 1 MB; client-side check plus the existing server check)
  - Name
  - Accent colour, with a "No colour" option
  - a "Show on ballot" switch (the existing `is_active`)
  - Slug, under a collapsed "Advanced" section
  - **Save** and **Cancel**

  One Save writes the fields and, if a new file was picked, uploads the logo. On success the sheet closes and the list refreshes. Errors show inside the sheet, with the existing messages.
- **Add team:** opens the same sheet, empty. The new team goes to the end of the order (the server computes max+1). An optional logo is uploaded after creation.
- The display-order number field is removed everywhere.

### Logo delivery
- `TeamBadge` stops using `unoptimized`, so logos go through `/_next/image`.
- `next.config` allows the Supabase public storage path for `team-logos` as a remote image source, and sets a long `minimumCacheTTL`. That's safe because every upload gets a new timestamped filename, so a changed logo always has a new URL.
- Local development and tests still work. Local Supabase runs on 127.0.0.1, which Next 16's optimizer refuses by default, so the builder handles that, e.g. by optimizing only for non-local hosts.

## Constraints
- Next.js 16 conventions in this repo (`cacheComponents`, client components for interactivity). Read `node_modules/next/dist/docs/` for `images` / `remotePatterns` / local IP behaviour before writing code.
- Mobile-only, 390×844 reference. Brand: navy `#0B2A5B`, yellow `#FFD21F`.
- **Motion rules:**
  - The root `MotionProvider` uses strict `LazyMotion`, so `Reorder` (which renders full `motion.*` components) must sit inside a nested non-strict `LazyMotion features={domMax}` in the admin teams list only.
  - Never import `motion/react`; the ESLint rule enforces this.
- All suites stay green (`npm test`, `npm run test:db`, `npm run lint`, `npm run build`), and the ballot bundle stays within budget.

## Left to the builder
Exact styling, animation timings, sheet layout details, and how the reorder server action validates its input. The action must reject a list that doesn't contain exactly the current team ids.
