# Doc IPL Voting — Phase 8 (Production Hardening) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the open items left by the earlier reviews, add load and concurrency tests for the vote flow, and leave the project ready to launch with an accurate README, an ops runbook and a test-matrix document. There are no new features.

**Architecture:** Small, local changes to existing modules. New tests go into the existing Vitest suites. Docs stay in the repo.

**Tech Stack:** unchanged (Next.js 16, Supabase, Vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md`. Open items come from `docs/superpowers/notes/phase-3-plus-carry-forward.md` ("From Phase 4+5 final review") and the Phase 7 final review. The test list comes from brief §18.

## Global Constraints

- No behaviour changes to the public flow, except those listed in the tasks.
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Everything stays green: `npm test`, `npm run test:db`, `npm run lint`, `npm run build`.

## Review Focus

1. **On a Vercel Preview deployment,** the vote API must not 403 every vote: the Origin check compares against the request's own origin there. Test: `origin check uses request origin off production` (Task 1).
2. **50 concurrent votes from different voters** are all counted exactly once. Test: `api load: 50 concurrent distinct voters` (Task 3).
3. **An empty "max votes" field** must not silently disable the device check. Test: `empty maxVotes rejected` (Task 2).

---

### Task 1: Vote API leftovers

**Files:** Modify `src/app/api/vote/route.ts`. Test: `tests/db/route-vote.test.ts` (extend).

**Behaviour:**
- **Origin check:**
  - When `process.env.VERCEL_ENV === 'production'`, compare against `new URL(getServerEnv().SITE_URL).origin`, as now.
  - Otherwise compare against `req.nextUrl.origin`.
  - A missing Origin is still allowed.
- **Logging:** log `console.warn('[vote] rejected: content-type')` and `console.warn('[vote] rejected: origin')` on those two rejections. Never log the raw origin value.
- **Size check:** reject early when the `content-length` header is greater than 8192, with 400 `token_invalid`, before reading the body. Keep the existing text-length check.
- **Test:** if `castVote` returns `ok` with a null `teamName`, respond 500 `network`. Use `vi.spyOn` on `@/lib/votes`.

- [ ] **Step 1: Failing tests:**
  - `origin check uses request origin off production`: with `VERCEL_ENV` unset, Origin `http://localhost:3000` matches the request URL host and is accepted, even when `SITE_URL` is something else. Stub `NEXT_PUBLIC_SITE_URL` through the env mock.
  - `production origin must match SITE_URL`: stub `VERCEL_ENV=production` and a foreign origin → 403.
  - `content-length too large → 400`.
  - `ok with null teamName → 500 network`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** All suites green. **Step 5:** Commit — `fix(vote): preview-safe origin check, early size reject, rejection logging`

---

### Task 2: Admin leftovers

**Files:** Modify `src/app/admin/(protected)/voting/actions.ts`, `src/app/admin/(protected)/teams/actions.ts`, `src/lib/admin.ts`. Tests: extend `tests/db/admin-actions-voting.test.ts` and `tests/db/admin-actions-teams.test.ts`.

**Behaviour:**
- `saveVotingAction`:
  - An empty or missing `maxVotes` gives the error `Enter max votes (0–1000).`
  - A missing start or end gives `Enter a valid start.` / `Enter a valid end.`
  - It writes only `voting_start`, `voting_end` and `max_votes_per_device_ip` through a new `updateVotingWindow({ start, end, maxVotesPerDeviceIp })` in `admin.ts`, so `is_enabled` is never touched. That removes the stale read-then-write.
  - The end-before-start mapping stays.
- `toggleVotingAction`: uses a new `setVotingEnabled(enabled: boolean)` that updates only `is_enabled`.
- `uploadLogoAction`: when `setTeamLogo` fails because the team doesn't exist (a valid uuid that isn't in the DB), return `Team not found.` Make `setTeamLogo` throw `Error('not_found')` in that case.

- [ ] **Step 1: Failing tests:**
  - `empty maxVotes rejected`: the config is unchanged.
  - `missing start rejected with friendly copy`.
  - `save never changes enabled`: enable, then save → still enabled. Disable, then save → still disabled.
  - `upload logo unknown uuid → Team not found.`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** All suites green. **Step 5:** Commit — `fix(admin): column-level config writes, stricter inputs, logo not-found`

---

### Task 3: Load and concurrency tests for the vote flow

**Files:** Create `tests/db/load.test.ts`.

**Behaviour (tests only):** these call the real `/v` `GET` and `/api/vote` `POST` handlers, with Turnstile mocked to pass, exactly as `tests/db/route-vote.test.ts` does. Mint tokens with distinct IPs, and set the mint and vote rate limits high for this file. If `getServerEnv` is cached, stub it per test or keep the minting sequential.

**Tests:**
- `api load: 50 concurrent distinct voters`:
  - mint 50 ballots, each with its own cookie, IP and device signal
  - `Promise.all` 50 POSTs across 3 teams
  - expect all to return 200
  - `get_results` total is 50, and the per-team counts match what was sent
- `api load: same cookie, 10 concurrent tokens`: exactly 1 returns 200, and 9 return 409 `already_voted`.
- `api load: 10 concurrent requests on one token`: exactly 1 returns 200, and 9 return 409.
- `api load: device cap under concurrency`:
  - cap 3, with 8 different cookies on the same IP and the same device signal, sent concurrently
  - exactly 3 return 200
- Keep the file under about 20s runtime.

- [ ] **Step 1:** Write the tests. They should pass against the current code; if any fails, that's a real bug, so stop and report BLOCKED with details.
- [ ] **Step 2:** Run `npm run test:db` → all green. Run it twice to check for flakiness. **Step 3:** Commit — `test: concurrency and load tests for the vote flow`

---

### Task 4: Launch docs — README, runbook, test matrix, spec sync

**Files:** Modify `README.md` and `docs/superpowers/specs/2026-11-19-docipl-voting-design.md` (sync only). Create `docs/RUNBOOK.md` and `docs/TEST-MATRIX.md`.

**Content:**
- **README go-live checklist additions:**
  - `NEXT_PUBLIC_SITE_URL` must equal the production origin exactly.
  - Previews must use a separate Supabase project (or no DB env vars), and Vercel Deployment Protection must stay on.
  - Keep "Automatically expose System Environment Variables" on, because the `VERCEL_ENV` checks depend on it.
  - `ADMIN_PASSWORD` must be 20+ random characters, and `ADMIN_SESSION_SECRET` 32+ random bytes.
  - Sessions can't be revoked one by one; rotating `ADMIN_SESSION_SECRET` logs everyone out.
  - Apply all 4 migrations with `npx supabase db push`, run `seed.sql` once, then run the Supabase advisors.
  - Upload team logos in `/admin/teams`.
  - Set the real window in `/admin/voting`.
  - Put the DM link `https://<host>/v` into HeyDM.
  - When running local browser tests, keep `.playwright-mcp/` (or any test output) outside the project folder, because the Next dev server watches it and reloads in a loop.
- **`docs/RUNBOOK.md`** (short, plain language for an organiser):
  - before launch
  - opening voting
  - watching (`/admin` and `/results`, plus the Vercel logs to watch)
  - pausing in an emergency
  - false blocks: raise the device cap or `RATE_LIMIT_*`
  - closing voting
  - export both CSVs
  - announcing the results
  - after the event: purge identifiers within 30 days; never resume voting after a purge
  - resetting test votes before launch (pause, then RESET)
  - rotating the admin secret
- **`docs/TEST-MATRIX.md`:** a table mapping every brief §18 item to the automated test(s) that cover it, by file and test name. The items are:
  - duplicate voting
  - expired token
  - reused token
  - before start
  - after end
  - invalid team
  - invalid Turnstile
  - rate limiting
  - refresh after voting
  - multiple browsers
  - mobile Safari
  - Chrome Android
  - slow network
  - simultaneous votes

  Mark the items that need a **manual real-device check**: mobile Safari, Chrome Android, the Instagram in-app browser on iOS and Android, "Open in browser", and slow network (Chrome DevTools "Slow 4G"). Add a short manual checklist for them.
- **Spec sync:** the §8 admin route is `/admin/voting` (not `/admin/settings`), logout is a Server Action, and `Referrer-Policy` is `same-origin`. Add a one-line "Implementation notes" section rather than rewriting the history.

- [ ] **Step 1:** Write the docs. Grep the test names to make sure every matrix entry points at a real test. **Step 2:** Run `npm run lint` and `npm run build` → OK. **Step 3:** Commit — `docs: runbook, test matrix, go-live checklist`

---

## After all tasks: controller full regression (production build, Playwright 390×844)

1. Public: open → vote → thanks with the team → refresh, revisit `/v` and the old link → `/thanks`. A fresh cookie hits the device cap on the 4th vote. Paused → paused screen. `/results` updates.
2. Admin: login, voting save and toggle, team edit and logo, CSV, reset, logout.
