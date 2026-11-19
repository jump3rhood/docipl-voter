# Doc IPL Voting — Phase 7 (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small password-protected admin area at `/admin`. It has:
- a dashboard: totals, votes per team, status, window
- voting controls: start/end in IST, enabled toggle, device cap
- team management: add/edit, order, active, logo upload
- results CSV export
- danger-zone actions: reset test votes, and purge identifiers after the event

**Architecture:**
- **Session:** a single shared `ADMIN_PASSWORD` produces a signed, HttpOnly `dipl_admin` cookie (HMAC with `ADMIN_SESSION_SECRET`, 12h).
- **Pages:** under `src/app/admin/(protected)/` behind a layout that verifies the session server-side.
- **Mutations:** Server Actions. **Every action re-verifies the session itself**; the layout check is not enough.
- **Data:** all DB access goes through `src/lib/admin.ts` (server-only, service role).
- **Destructive operations:** run in SQL functions, so they're atomic and guarded.
- **Logos:** stored in a public Supabase Storage bucket, `team-logos`.

**Tech Stack:** Next.js 16 Server Actions, Supabase (Postgres + Storage), zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md` §8 (Admin), §12 (reset/purge decisions). Carry-forward: `docs/superpowers/notes/phase-3-plus-carry-forward.md`, sections "Admin (Phase 7)" and "During voting".

## Global Constraints

- **Admin cookie:**
  - name `dipl_admin`
  - value `v1.<expEpochSeconds>.<hmacHex>`, where `hmacHex = hmacHex(ADMIN_SESSION_SECRET, 'v1.' + exp)`
  - `httpOnly`, `sameSite: 'strict'`, `path: '/'` (needed so it reaches `/admin` and the export route), `secure` in production
  - `maxAge` 12h
  - Verification is timing-safe and rejects expired or malformed values.
- **Password check:** timing-safe. Compare `sha256` digests of the input and `ADMIN_PASSWORD` with `crypto.timingSafeEqual`.
- **Login rate limit:** `rateLimitHit('adminLogin', hashId(ipKey(ip ?? 'unknown')))` before checking the password. Failure copy is `Wrong password.`; when rate-limited it is `Too many attempts. Try again later.`
- **Every Server Action and admin route handler** starts with `await requireAdmin()`. It throws or redirects to `/admin/login` if the session is invalid. Admin pages and the export route are never cached (`connection()` / `no-store`).
- **Times:** inputs use `<input type="datetime-local">` interpreted as IST (Asia/Kolkata, +05:30). They are stored as `timestamptz` and shown back in IST.
- **Logo upload:** only `image/png`, `image/jpeg`, `image/webp`, max 1 MB. The object path is `<slug>-<Date.now()>.<ext>` in bucket `team-logos`, and `logo_url` is set to the public URL. SVG is rejected.
- **Slug:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 40 chars. Accent colour: `^#[0-9A-Fa-f]{6}$` or empty (stored as null).
- **Reset:** allowed only while `is_enabled = false`, and the confirmation input must equal `RESET`. Purge needs the confirmation `PURGE`.
- **UI:** mobile-first, single column, brand tokens, the same primary button style as the public pages. Admin pages have `robots: noindex`.
- **Commits:** commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A Server Action called without a valid session cookie** must be rejected even though the page layout is bypassed. Test: `actions reject without session` (Tasks 3–5).
2. **Tampered or expired admin cookie** is rejected. Tests: `session` unit tests (Task 1).
3. **Reset while voting is enabled** is refused at the SQL level. Test: `admin_reset_votes refuses when enabled` (Task 2).
4. **IST round trip:** `2026-11-21T09:00` in the form is stored as `2026-11-21T03:30:00Z` and shown back as `2026-11-21T09:00`. Test: `ist` unit tests (Task 3).
5. **Uploading a non-image or oversize file** is rejected with a clear message and `logo_url` is unchanged. Test: `logo validation` (Task 4).

---

### Task 1: Admin session, login and logout

**Files:**
- Create: `src/lib/adminSession.ts`, `src/lib/adminAuth.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `src/app/admin/(protected)/layout.tsx`, `src/app/admin/(protected)/page.tsx` (placeholder heading `Admin` until Task 3), `src/app/admin/logout/route.ts`
- Modify: `src/lib/votes.ts` (`rateLimitHit` bucket type adds `'adminLogin'`)
- Test: `tests/adminSession.test.ts`, `tests/db/admin-login.test.ts`

**Interfaces:**
- `adminSession.ts` (pure apart from `node:crypto`):
  - `ADMIN_COOKIE = 'dipl_admin'`
  - `signSession(secret: string, now?: number): string`
  - `verifySession(secret: string, value: string | undefined, now?: number): boolean`
  - `checkPassword(input: string, expected: string): boolean`
- `adminAuth.ts` (server-only):
  - `isAdmin(): Promise<boolean>` reads the cookie via `cookies()`.
  - `requireAdmin(): Promise<void>` calls `redirect('/admin/login')` when the session is invalid.
- `login/actions.ts`: `loginAction(prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }>` (`'use server'`). It rate-limits, checks the password, sets the cookie and redirects to `/admin`.
- `/admin/login` page: a password field (`autocomplete="current-password"`), a `LOG IN` button and the error text, using `useActionState`. If the user is already logged in, it redirects to `/admin`.
- `/admin/logout` route: `POST` clears the cookie and returns 303 to `/admin/login`. The layout has a small logout form button.
- `(protected)/layout.tsx`: `await connection(); await requireAdmin();`. It renders an admin nav with Dashboard · Voting · Teams · Results, plus Log out. It sets `metadata.robots = { index: false }`.

- [ ] **Step 1: Failing tests:**
  - `signSession`/`verifySession` round trip.
  - Tampered HMAC → false.
  - Expired (now + 13h) → false.
  - Malformed values (`''`, `'v1.x'`, `'v2.1.aa'`) → false.
  - Different secret → false.
  - `checkPassword` true/false, including different lengths.
  - DB test: `rateLimitHit('adminLogin', …)` respects the `RATE_LIMIT_ADMIN_LOGIN` set in the DB vitest env (add `'3/900'`): true ×3, then false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run test:db`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(admin): password login with signed session cookie`

---

### Task 2: Admin data layer, storage bucket and guarded SQL

**Files:**
- Create: `supabase/migrations/20261119000004_admin.sql`, `src/lib/admin.ts`
- Modify: `src/lib/database.types.ts` (regenerated)
- Test: `tests/db/admin.test.ts`

**Interfaces:**
- Migration:
  - Insert the public storage bucket `team-logos`, idempotently: `insert into storage.buckets (id, name, public) values ('team-logos','team-logos',true) on conflict (id) do nothing`.
  - `admin_reset_votes() returns text`: returns `'refused'` if voting is enabled; otherwise deletes votes, voting_tokens, voters and rate_limits, and returns `'ok'`.
  - `admin_purge_identifiers() returns int`: deletes voters, voting_tokens and rate_limits; sets `ip_hash`, `device_hash` and `user_agent_hash` to null on votes; returns the number of votes kept.
  - Both functions are security definer, `search_path = public`, and executable only by service_role.
- `admin.ts` (server-only; every function throws on a DB error):
  - `type AdminTeam = Team & { displayOrder: number; isActive: boolean }`
  - `type AdminConfig = { start: Date; end: Date; enabled: boolean; maxVotesPerDeviceIp: number }`
  - `getAdminConfig(): Promise<AdminConfig>`
  - `updateAdminConfig(c: AdminConfig): Promise<void>` (the DB check rejects end ≤ start; surface it as an error)
  - `listAllTeams(): Promise<AdminTeam[]>` (includes inactive teams, ordered by `display_order`)
  - `createTeam(t: { name: string; slug: string; accentColor: string | null; displayOrder: number }): Promise<void>`
  - `updateTeam(id: string, t: { name: string; slug: string; accentColor: string | null; displayOrder: number; isActive: boolean }): Promise<void>`
  - `setTeamLogo(id: string, file: { bytes: ArrayBuffer; type: string; slug: string }): Promise<string>`: uploads, sets `logo_url` and returns the URL
  - `resetVotes(): Promise<'ok' | 'refused'>`
  - `purgeIdentifiers(): Promise<number>`
  - `exportVotesCsvRows(): Promise<{ team: string; createdAt: string }[]>`

- [ ] **Step 1: Failing DB tests:**
  - `admin_reset_votes refuses when enabled`
  - `reset ok when disabled clears votes/tokens/voters`
  - `purge keeps votes, nulls hashes, deletes voters/tokens`
  - `create/update team round trip incl. inactive`
  - `duplicate slug rejected`
  - `updateAdminConfig rejects end before start`
  - `setTeamLogo uploads to team-logos and sets logo_url` (upload a tiny PNG buffer, then GET the public URL → 200)
  - add `admin_reset_votes` and `admin_purge_identifiers` to the anon-cannot-rpc list
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the migration, then `npm run db:reset`, `npm run db:types`, then `admin.ts`.
- [ ] **Step 4:** Run `npm run test:db`, `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(admin): data layer, logo bucket, guarded reset and purge`

---

### Task 3: Dashboard and voting controls

**Files:**
- Create: `src/lib/ist.ts`, `src/app/admin/(protected)/voting/page.tsx`, `src/app/admin/(protected)/voting/actions.ts`
- Modify: `src/app/admin/(protected)/page.tsx`
- Test: `tests/ist.test.ts`, `tests/db/admin-actions-voting.test.ts`

**Interfaces:**
- `ist.ts` (pure):
  - `istLocalToDate(v: string): Date` accepts `YYYY-MM-DDTHH:mm` and throws on an invalid value.
  - `dateToIstLocal(d: Date): string`.
- **Dashboard** `/admin`: the cards below (all from `getResults()` and `getAdminConfig()`), plus a plain `<a href="/v">` link `Open test ballot`.
  - Status: `deriveVotingState`, worded `Not started`, `Open`, `Paused` or `Closed`.
  - Total votes.
  - Start and end via `formatIST`.
  - A compact per-team table: name, votes, %.
- **Voting** `/admin/voting`: a form with Start and End (`datetime-local`, prefilled in IST), `Voting enabled` (checkbox) and `Max votes per device + network` (number 0–1000, help text `0 turns this check off`). The `SAVE` button shows success text `Saved.` or the error. A separate quick form offers `PAUSE VOTING` / `RESUME VOTING`, which flips only `enabled`.
- `voting/actions.ts`:
  - `saveVotingAction(prev, formData)` and `toggleVotingAction(formData)`.
  - Each starts with `await requireAdmin()` and validates with zod. End must be after start (`End must be after start.`).
  - Each calls `revalidatePath` for `/`, `/admin` and `/admin/voting` where relevant.

- [ ] **Step 1: Failing tests:**
  - IST: `istLocalToDate('2026-11-21T09:00').toISOString() === '2026-11-21T03:30:00.000Z'`.
  - IST: `dateToIstLocal(new Date('2026-11-22T15:30:00Z')) === '2026-11-22T21:00'`.
  - IST: invalid input throws.
  - DB action tests: `actions reject without session` (mock `next/headers` cookies to return none and `next/navigation` redirect to throw a sentinel). The action throws the sentinel and the config is unchanged.
  - DB action tests: with a valid signed cookie, `saveVotingAction` persists the values. `end before start` returns the error.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run test:db`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(admin): dashboard and voting controls`

---

### Task 4: Team management with logo upload

**Files:**
- Create: `src/app/admin/(protected)/teams/page.tsx`, `src/app/admin/(protected)/teams/actions.ts`, `src/lib/logoValidation.ts`
- Test: `tests/logoValidation.test.ts`, `tests/db/admin-actions-teams.test.ts`

**Interfaces:**
- `logoValidation.ts` (pure): `validateLogo(file: { type: string; size: number }): { ok: true; ext: 'png' | 'jpg' | 'webp' } | { ok: false; error: string }`. The errors are `Use a PNG, JPG or WEBP image.` and `Image must be 1 MB or smaller.`
- `/admin/teams` lists all teams, including inactive ones. Each row is an inline edit form with:
  - name, slug, accent (`<input type="color">` plus a "no colour" checkbox), display order and an active checkbox
  - the current badge (`TeamBadge`) and a logo file input
  - `SAVE` and `UPLOAD LOGO` buttons

  An `Add team` form sits at the bottom.
- `teams/actions.ts`: `createTeamAction`, `updateTeamAction` and `uploadLogoAction`. Each begins with `requireAdmin()` and validates per Global Constraints. A duplicate slug gives the error `That slug is already used.` Each action revalidates `/admin/teams`, `/results` and `/vote` (layout).

- [ ] **Step 1: Failing tests:**
  - `logo validation`: png, jpg and webp are ok; svg, gif and pdf are rejected; 1 MB + 1 byte is rejected.
  - DB action tests:
    - `actions reject without session`
    - `create team then appears active on getActiveTeams`
    - `deactivate hides from getActiveTeams`
    - `duplicate slug error`
    - `bad accent rejected`
    - `upload logo sets logo_url` (a FormData with a small PNG Blob)
    - `oversize logo rejected, logo_url unchanged`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run test:db`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(admin): team management and logo upload`

---

### Task 5: Results export and danger zone

**Files:**
- Create: `src/app/admin/(protected)/results/page.tsx`, `src/app/admin/(protected)/results/actions.ts`, `src/app/admin/export/route.ts`, `src/lib/csv.ts`
- Test: `tests/csv.test.ts`, `tests/db/admin-export.test.ts`

**Interfaces:**
- `csv.ts` (pure): `toCsv(header: string[], rows: (string | number)[][]): string`. It uses RFC 4180 quoting and CRLF line endings. Cells starting with `=`, `+`, `-` or `@` get a leading `'` to prevent formula injection.
- `GET /admin/export?type=results|votes`:
  - Checks the session with `isAdmin()` and returns 401 if it's invalid.
  - `results` gives `team,votes,percent`; `votes` gives `team,created_at`.
  - Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="docipl-results.csv"` (or `docipl-votes.csv`), and `Cache-Control: no-store`.
- `/admin/results`:
  - A live table: reuse `Leaderboard` with `state`, or a simple table from `getResults()`.
  - Two download links.
  - A **Danger zone** with two forms:
    - `Reset all votes & tokens`: confirm input `RESET`; disabled with the note `Pause voting first.` while voting is enabled.
    - `Purge identifiers`: confirm input `PURGE`; the note says `Run only after voting has closed.`
  - The result messages are `Reset done.`, `Voting must be paused before reset.` and `Purged identifiers; {n} votes kept.`
- `results/actions.ts`: `resetAction` and `purgeAction`, each with `requireAdmin()` and the confirmation check.

- [ ] **Step 1: Failing tests:**
  - csv: quoting of commas, quotes and newlines; CRLF; formula guard (`=1+1` becomes `'=1+1`).
  - export route: 401 without the cookie; 200 with a valid cookie, correct headers, and a body with the header line and team rows.
  - actions: `reset refused while enabled`; `reset needs RESET`; `purge needs PURGE`; `actions reject without session`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run test:db`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(admin): results export and danger zone`

---

## After all tasks: controller Playwright pass (390×844)

1. `/admin` without login → `/admin/login`. A wrong password shows `Wrong password.`; the right one opens the dashboard.
2. Voting page: set start to now−1h, end to now+1 day, enable, save → `Saved.` → the public `/` shows `Voting is open!`.
3. Teams: rename a team, upload a PNG logo → the ballot and `/results` show the logo; deactivate a team → it disappears from the ballot.
4. Cast a vote via `/v`, then the dashboard total updates. The CSV download returns rows.
5. Pause voting → the public `/` shows paused. Reset with `RESET` → the totals go to 0.
6. Log out → `/admin` redirects to the login page.
