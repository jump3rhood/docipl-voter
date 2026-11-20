# Admin Menu, Team List and Logo Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the phone-only admin a slide-out hamburger menu and a drag-sortable Teams list with a slide-up editor that includes the logo upload. Serve every team logo through Next's image optimizer, so 10k voters don't drain Supabase's download allowance.

**Architecture:**
- Server actions in `teams/actions.ts` change shape: the logo becomes optional in create and update, display order is removed, and there's a new reorder action. `src/lib/admin.ts` gains `reorderTeams`.
- The client UI is split into `AdminNav`, `TeamList` (with framer-motion `Reorder`) and `TeamEditorSheet`.
- `TeamBadge` opts into optimization for remote hosts, configured in `next.config.ts`.

**Tech Stack:** Next.js 16 (`cacheComponents`), React 19, framer-motion 14.14.0, Supabase, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-20-admin-teams-and-nav-design.md`

## Global Constraints

- Mobile-only, 390×844. Brand: navy `#0B2A5B`, yellow `#FFD21F`. Reuse `primaryButtonClass` and the existing admin input styling.
- **No new migrations, no schema changes, no new npm dependencies.**
- Never import `motion/react` (ESLint enforces it). Use `framer-motion`.
  - The root `MotionProvider` uses strict `LazyMotion`, so `Reorder` must sit inside a nested `<LazyMotion features={domMax}>` with no `strict`, in the teams list only.
- Logo rule (unchanged): PNG, JPG or WEBP, at most 1 MB (`MAX_LOGO_BYTES`, `validateLogo` in `src/lib/logoValidation.ts`). Error copy stays:
  - `Use a PNG, JPG or WEBP image.`
  - `Image must be 1 MB or smaller.`
  - `Team not found.`
  - `That slug is already used.`
- The ballot JS budget is ≤196 KB gzipped (measure as in the motion work: production build, sum of the `.js` responses for `/v` → ballot at 390×844).
- Read `node_modules/next/dist/docs/` on `images` (`remotePatterns`, `minimumCacheTTL`, local IP handling) before Task 2.
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Everything stays green: `npm test`, `npm run test:db`, `npm run lint`, `npm run build`.

## Review Focus

1. **A reorder list that doesn't match the current teams** (a stale tab, or a team added meanwhile) is rejected without changing anything. Test: `reorder rejects stale id list` (Task 1).
2. **Saving the editor with no new file** keeps the existing logo. Test: `update without logo keeps logo_url` (Task 1).
3. **A bad logo when creating a team** must not leave a half-created team. Validate before inserting. Test: `create with bad logo creates nothing` (Task 1).
4. **The local Supabase logo URL (127.0.0.1)** must still render in dev and tests rather than being refused by the optimizer. Test: `local logo hosts skip optimization` (Task 2).
5. **The hamburger panel must not trap the page:** Escape, backdrop and link taps close it and restore body scroll. Test: `AdminNav closes on Escape, backdrop and link; restores scroll` (Task 3).

---

### Task 1: Team server actions — optional logo, server-side order, reorder

**Files:**
- Modify: `src/app/admin/(protected)/teams/actions.ts`, `src/lib/admin.ts`
- Test: `tests/db/admin-actions-teams.test.ts`, `tests/db/admin.test.ts` (update and extend)

**Interfaces:**
- **Produces, for Task 4:**
  - `createTeamAction(prev: TeamState, formData: FormData): Promise<TeamState>`
    - Fields: `name`, `slug`, `accent`, `noAccent`, optional `logo` (File).
    - Behaviour: puts the team at max(display_order)+1. A non-empty `logo` is validated **before** inserting, then uploaded after the insert via `setTeamLogo`.
  - `updateTeamAction(prev, formData)`
    - Fields: `id`, `name`, `slug`, `accent`, `noAccent`, `isActive` ('on'), optional `logo`.
    - Behaviour: validates the logo first, updates the fields, then uploads if a non-empty file was given. With no file (or a 0-byte file), `logo_url` is left unchanged.
  - `reorderTeamsAction(ids: string[]): Promise<TeamState>`. Requires admin, then calls `reorderTeams`. Errors:
    - a mismatch returns `{ error: 'The team list changed. Reload and try again.' }`
    - success returns `{ ok: true }` and revalidates as now
  - `TeamState` is unchanged.
- **Produces, in `src/lib/admin.ts`:** `reorderTeams(ids: string[]): Promise<void>`.
  - Throws `Error('stale_list')` unless `ids` holds exactly the current team ids: same set, same length, no duplicates.
  - Otherwise sets `display_order = index + 1` for each id.
- `createTeam` drops its `displayOrder` parameter and computes max+1 itself; `updateTeam` drops `displayOrder`.
- `uploadLogoAction` is **deleted**. `setTeamLogo` stays.

- [ ] **Step 1: Update and write the failing tests**
  - `tests/db/admin-actions-teams.test.ts`:
    - Remove `displayOrder` from `newTeam`.
    - Change the existing upload tests to go through `updateTeamAction` with a `logo` field.
    - Drop `uploadLogoAction` from the imports and from the no-session test, and add `reorderTeamsAction(['x'])` → rejects `REDIRECT:/admin/login`.
  - New tests:
    - `create puts team last`: the created team's display_order equals the previous max + 1.
    - `create with logo sets logo_url`: a `PNG` blob of type `image/png` → `logo_url` contains `/team-logos/zz-team-`.
    - `create with bad logo creates nothing`: a `text/plain` blob → `{ error: 'Use a PNG, JPG or WEBP image.' }`, and no `zz-team` row exists.
    - `update without logo keeps logo_url`: set a logo, then update the name with no `logo` field → `logo_url` is unchanged.
    - `update with oversize logo changes nothing`: 1 MB + 1 byte → `{ error: 'Image must be 1 MB or smaller.' }`, and the name is unchanged.
    - `reorder writes 1..n in given order`: reverse the current id list, call `reorderTeamsAction` → `{ ok: true }`, and display_order runs 1..n in the reversed order.
    - `reorder rejects stale id list`: a list missing one id → the error copy above. A list with a duplicate → the same error. No display_order changed.
  - `tests/db/admin.test.ts`: update the `createTeam`/`updateTeam` calls to the new signatures, and add `reorderTeams throws stale_list on mismatch`.
- [ ] **Step 2: Run `npm run test:db`.** The new tests should FAIL.
- [ ] **Step 3: Implement** the interfaces above.
  - In create and update, call `validateLogo(file)` up front when `file instanceof File && file.size > 0`.
  - Map the `setTeamLogo` errors to the existing copy.
- [ ] **Step 4: Run all suites.** `npm run test:db` and `npm test` are green. `npm run lint` will flag `TeamForms.tsx` still importing `uploadLogoAction`. Make a minimal edit there now so the build stays green: remove the upload form and the display-order field. Task 4 replaces this file anyway.
- [ ] **Step 5: Commit:** `feat(admin): optional logo in team create/update, server-side order, reorder action`

---

### Task 2: Optimized logo delivery

**Files:**
- Create: `src/lib/logoImage.ts`
- Modify: `src/components/TeamBadge.tsx`, `next.config.ts`
- Test: `tests/logoImage.test.ts`

**Interfaces:**
- **Produces:** `shouldOptimizeLogo(url: string): boolean`.
  - It is `false` for relative URLs that are not http(s) (keep current behaviour), for hosts `localhost`, `127.0.0.1` and `::1`, and for unparsable URLs.
  - Otherwise it is `true` for `https:` URLs.
- `TeamBadge` passes `unoptimized={!shouldOptimizeLogo(logoUrl)}`, and adds `sizes` matching the rendered pixel size so the optimizer picks a small width.

- [ ] **Step 1: Failing tests** in `tests/logoImage.test.ts`:
  - `remote supabase logo is optimized`: `https://abc.supabase.co/storage/v1/object/public/team-logos/x-1.png` → true.
  - `local logo hosts skip optimization`: `http://127.0.0.1:54321/storage/v1/object/public/team-logos/x.png` → false, and the `localhost` equivalent → false.
  - `garbage url → false`.
- [ ] **Step 2: Run.** It should FAIL.
- [ ] **Step 3: Implement.** In `next.config.ts`, add `images`:
  - a `remotePatterns` entry for `https://*.supabase.co/storage/v1/object/public/team-logos/**`
  - `minimumCacheTTL: 2678400` (31 days; every upload gets a new timestamped filename, so a changed logo always has a new URL)
  - Keep everything else in the config unchanged.
- [ ] **Step 4: Verify.**
  - All suites are green.
  - `npm run build` passes.
  - On the production build (port 3100, never 3000), the ballot shows the local Supabase logos (unoptimized locally), and the HTML `src` for a remote-host URL goes through `/_next/image` (unit-level is enough if local data has no remote URLs).
- [ ] **Step 5: Commit:** `feat(logos): serve team logos through the Next image optimizer`

---

### Task 3: Hamburger admin menu

**Files:**
- Create: `src/components/admin/AdminNav.tsx` (client)
- Modify: `src/app/admin/(protected)/layout.tsx`
- Test: `tests/AdminNav.test.tsx`

**Interfaces:**
- **Produces:** `AdminNav({ logout }: { logout: React.ReactNode })`.
  - The layout passes the existing `<form action={logoutAction}>…Log out</form>` as `logout`.
  - `AdminNav` renders the top bar (current page label, ☰ button) and the panel with the links:
    - Dashboard `/admin`
    - Voting `/admin/voting`
    - Teams `/admin/teams`
    - Results `/admin/results`
  - It uses `usePathname` to set `aria-current="page"`. Pathnames `/admin/teams/...` match Teams; `/admin` matches Dashboard only on an exact match.
- **Behaviour (from the spec):**
  - ☰ has `aria-label="Open menu"`, `aria-expanded` and `aria-controls`. The panel has `role="dialog"`, `aria-modal="true"`, `aria-label="Admin menu"`, and a ✕ button `aria-label="Close menu"`.
  - It closes on a link click, the backdrop, ✕, Escape, or a pathname change. Focus moves to the first link on open, Tab is trapped, and focus returns to ☰ on close.
  - `document.body.style.overflow` is `hidden` while open and restored on close.
  - Slide: CSS `transform` transition, disabled under `motion-reduce:`.

- [ ] **Step 1: Failing tests** in `tests/AdminNav.test.tsx` (mock `next/navigation` `usePathname`):
  - `shows current page label and marks link current`: pathname `/admin/teams` → the top bar reads "Teams", and the Teams link has `aria-current="page"`.
  - `AdminNav closes on Escape, backdrop and link; restores scroll`: open → body overflow is `hidden`. Escape → the dialog is gone, overflow is restored, and focus is on ☰. Repeat for a backdrop click and a link click.
  - `focus moves into panel and Tab wraps`.
  - `renders logout slot inside panel`.
- [ ] **Step 2: Run.** It should FAIL.
- [ ] **Step 3: Implement**, and replace the inline `<nav>` in the layout with `<AdminNav logout={…} />`. Keep `requireAdmin` and `Suspense` as they are.
- [ ] **Step 4: Run all suites.** They should be green, with the build OK.
- [ ] **Step 5: Commit:** `feat(admin): slide-out hamburger menu`

---

### Task 4: Teams list with drag reorder and slide-up editor

**Files:**
- Create: `src/app/admin/(protected)/teams/TeamList.tsx` (client) and `src/app/admin/(protected)/teams/TeamEditorSheet.tsx` (client)
- Delete: `src/app/admin/(protected)/teams/TeamForms.tsx`
- Modify: `src/app/admin/(protected)/teams/page.tsx`
- Test: `tests/TeamList.test.tsx`, `tests/TeamEditorSheet.test.tsx`

**Interfaces:**
- **Consumes:** the Task 1 actions and `TeamBadge`.
- **Produces:**
  - `TeamList({ teams }: { teams: AdminTeam[] })`, where `AdminTeam` comes from `src/lib/admin.ts`.
  - `TeamEditorSheet({ team, onClose }: { team: AdminTeam | null; onClose: () => void })`. `team === null` means "Add team".
- **Behaviour (from the spec):**
  - **TeamList:**
    - Rows hold: ⠿ handle (`aria-hidden`, `touch-action: none`), `TeamBadge` at 40, the name, an accent dot, and a pill (`Live` if active, `Hidden` if not).
    - Each row's main area is a `button` that opens the editor.
    - Each row also has "Move up" and "Move down" buttons with `aria-label="Move {name} up"` / `"Move {name} down"`. The first row's up and the last row's down are disabled.
    - **Drag:** `Reorder.Group` / `Reorder.Item` with `dragListener={false}` and `useDragControls`, started from the handle's `onPointerDown`. On drag end, call `reorderTeamsAction(currentIds)` if the order changed. Move up/down call it immediately.
    - **Status:** a polite live region shows `Saving…`, then `Order saved`. On an error it shows the error and resets the order to the last saved list.
    - "＋ Add team" opens the editor with `team = null`.
  - **TeamEditorSheet:**
    - A bottom sheet, like `ConfirmVoteSheet`: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, and Escape/backdrop close unless pending.
    - The title is "Edit {name}" or "Add team".
    - The form holds:
      - a logo picker: a `<label>` around the badge preview plus a visually hidden `<input type="file" name="logo" accept="image/png,image/jpeg,image/webp">`, previewed with `URL.createObjectURL` (revoked on change and unmount); a client-side `validateLogo` shows the error immediately and blocks submit
      - Name
      - Accent colour with "No colour" (same field names as now: `accent`, `noAccent`)
      - "Show on ballot" checkbox `name="isActive"` (edit only; new teams are active)
      - Slug inside `<details><summary>Advanced</summary>`
      - hidden `id` when editing
    - Submit uses `useActionState` with `updateTeamAction` or `createTeamAction`. On `{ ok: true }` it calls `onClose()`; the server's revalidation refreshes the list. Errors render inside the sheet with `role="alert"`.
    - Buttons: **SAVE** (`SAVING…` while pending) and **Cancel**.
  - Wrap the list in `<LazyMotion features={domMax}>` (non-strict), importing `domMax` from `framer-motion` inside this admin-only file.
- `page.tsx` renders the heading and `<TeamList teams={teams} />`.

- [ ] **Step 1: Failing tests:**
  - **`tests/TeamList.test.tsx`** (mock `./actions`):
    - `renders rows in order with Live/Hidden pills`
    - `move down calls reorderTeamsAction with swapped ids and announces Order saved`
    - `first row move up disabled, last row move down disabled`
    - `reorder error shows message and restores order`
    - `tapping a row opens the editor titled Edit {name}`
    - `Add team opens editor titled Add team`
  - **`tests/TeamEditorSheet.test.tsx`** (mock `./actions`):
    - `edit sheet pre-fills name, colour, show on ballot; slug under Advanced`
    - `oversize file shows Image must be 1 MB or smaller. and disables SAVE`
    - `wrong type shows Use a PNG, JPG or WEBP image.`
    - `picked file shows preview img with blob: src`
    - `Escape and Cancel call onClose`
    - `ok result calls onClose; error result shows alert and stays open`
- [ ] **Step 2: Run.** It should FAIL.
- [ ] **Step 3: Implement**, and delete `TeamForms.tsx`.
- [ ] **Step 4: Verify:**
  - All four suites are green.
  - The ballot bundle is still ≤196 KB gzipped, and the new framer-motion `Reorder`/`domMax` code appears only in admin chunks.
- [ ] **Step 5: Commit:** `feat(admin): drag-sortable team list with slide-up editor`

---

## After all tasks: controller check (production build on port 3100, Playwright 390×844 with touch)

1. Log in. Open ☰ → the panel slides in. Tap Teams → it closes and navigates. Escape and the backdrop also close it.
2. Teams:
   - Drag a row by its handle to a new spot → "Order saved". Reload → the order persists. `/v` ballot order matches.
   - Tap a row → the editor opens. Pick a PNG under 1 MB → the preview shows. SAVE → the list shows the new logo.
   - An oversize file shows the error.
   - Add team → it appears last.
3. The ballot still shows logos, and there are no page errors.
