# Doc IPL Voting — Phase 1 & 2 (Setup + Database) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app with tested server utilities, and create the complete Supabase schema: tables, constraints, RLS, voting functions and seed data. All of it is verified against a local Supabase.

**Architecture:** Next.js App Router (TypeScript, Tailwind) talks to Supabase **only from the server**, with the service-role key. All vote integrity logic lives in `SECURITY DEFINER` Postgres functions, so it's atomic and constraint-backed. Phases 3–7 will call these functions through thin TS wrappers.

**Tech Stack:** Next.js (latest, App Router, `src/`), TypeScript, Tailwind, zod, `@supabase/supabase-js`, `server-only`, Vitest, Supabase CLI (npm devDependency, local stack via Docker; Docker 29 and Node 24 are installed).

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md`

## Global Constraints

- No Supabase client in the browser; `src/lib/supabase.ts` imports `server-only`.
- The Supabase URL env var is `SUPABASE_URL`, not `NEXT_PUBLIC_…`, because it's only used on the server. This is a planner's call that departs from spec §9b.
- Every table has RLS enabled with **no policies**; `anon` and `authenticated` have no table privileges and no `EXECUTE` on functions; only `service_role` may execute.
- Raw tokens, cookie values and IPs are never stored; only hashes (`token_hash` = sha256 hex; everything else = HMAC-SHA256 hex with `HASH_SECRET`).
- Voting is open iff `is_enabled AND voting_start <= now() AND now() < voting_end`.
- `max_votes_per_device_ip` default **3**; `0` = check disabled.
- Token TTL default 2h, capped at `voting_end`.
- Seeded `voting_config` is **disabled** with placeholder dates.
- Exactly 11 seeded teams: `Team 1`…`Team 11`, slugs `team-1`…`team-11`, `display_order` 1…11.
- Commit after each task. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Two submits of the same token at the same moment** must produce exactly one vote. Test: `cast_vote concurrency` (Task 5).
2. **A token past `expires_at` whose status is still `active`** must be rejected as `token_invalid`. Test: `rejects time-expired token` (Task 5).
3. **The window boundary:** at `now() >= voting_end` voting is closed even if enabled, and a disabled window before the end reads as "not open". Tests: `voting_state` cases (Task 5).
4. **An inactive or non-existent team** must be rejected without consuming the token, so the user can retry. Test: `invalid team leaves token active` (Task 5).
5. **The anon key** must not read tables or call functions. Test: `anon is locked out` (Task 4) and `anon cannot rpc` (Task 5).

---

### Task 1: Scaffold Next.js app, base layout, test runner

**Files:**
- Create (generated): `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`, eslint config
- Create: `vitest.config.ts`, `tests/smoke.test.ts`, `.env.example`

**Interfaces:**
- Produces: `npm test` (vitest unit, `tests/**/*.test.ts` excluding `tests/db/**`), `npm run test:db` (Task 4), path alias `@/*` → `src/*`.

- [ ] **Step 1: Generate the app**

Run: `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes`
If it refuses because `docs/` or `.git` exist, generate into `../docipl-tmp` with the same flags, move everything except `.git` into this folder, and delete `../docipl-tmp`.
Expected: `npm run dev` serves the starter page.

- [ ] **Step 2: Install deps**

Run: `npm i zod @supabase/supabase-js server-only` and `npm i -D vitest supabase dotenv`

- [ ] **Step 3: Add the vitest config and smoke test**

`vitest.config.ts`: node environment, alias `@` → `src`, `include: ['tests/**/*.test.ts']`, `exclude: ['tests/db/**']`.
`tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
`package.json` scripts: `"test": "vitest run"`, `"test:db": "vitest run --config vitest.db.config.ts"`, `"db:start": "supabase start"`, `"db:reset": "supabase db reset"`, `"db:types": "supabase gen types typescript --local > src/lib/database.types.ts"`.

- [ ] **Step 4: Replace the starter UI with the base layout**

`layout.tsx`: `lang="en"`, metadata title `Doc IPL People's Choice`, viewport `width=device-width, initial-scale=1`, `themeColor`. The body is a centred `max-w-md` mobile column with a `DOC IPL` wordmark header.
`page.tsx`: placeholder heading `DOC IPL PEOPLE'S CHOICE` with the text `Voting opens soon.` Remove the starter assets from `public/`.

- [ ] **Step 5: Add `.env.example`**

List every variable from Task 3's schema with empty values and a comment per line. In Turnstile's comment, include the test keys `1x00000000000000000000AA` (site) and `1x0000000000000000000000000000000AA` (secret).

- [ ] **Step 6: Verify**

Run: `npm test` → 1 passed. Run: `npm run lint` → no errors. Run: `npm run build` → success.

- [ ] **Step 7: Commit** — `chore: scaffold Next.js app with Tailwind and Vitest`

---

### Task 2: Crypto helpers

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `tests/crypto.test.ts`

**Interfaces:**
- Produces:
  - `randomToken(bytes?: number): string` — default 32 bytes, base64url, no padding (43 chars).
  - `sha256Hex(input: string): string` — 64 lowercase hex chars.
  - `hmacHex(secret: string, input: string): string` — HMAC-SHA256, 64 lowercase hex chars.

- [ ] **Step 1: Write failing tests**

```ts
test('randomToken is 43 url-safe chars and unique', () => {
  const a = randomToken(), b = randomToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(a).not.toBe(b);
});
test('sha256Hex known vector', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('hmacHex depends on secret', () => {
  expect(hmacHex('k1', 'x')).toMatch(/^[0-9a-f]{64}$/);
  expect(hmacHex('k1', 'x')).not.toBe(hmacHex('k2', 'x'));
  expect(hmacHex('k1', 'x')).toBe(hmacHex('k1', 'x'));
});
```

- [ ] **Step 2: Run** `npm test -- crypto` → FAIL (module not found)
- [ ] **Step 3: Implement** with `node:crypto` (`randomBytes`, `createHash`, `createHmac`).
- [ ] **Step 4: Run** `npm test -- crypto` → PASS
- [ ] **Step 5: Commit** — `feat: add token and hashing helpers`

---

### Task 3: Server env validation + Supabase server client

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase.ts`
- Test: `tests/env.test.ts`

**Interfaces:**
- Produces:
  - `parseServerEnv(source: Record<string, string | undefined>): ServerEnv`. It throws an `Error` whose message lists every missing or invalid variable name.
  - `getServerEnv(): ServerEnv` — memoised `parseServerEnv(process.env)`.
  - `type RateLimit = { max: number; windowSeconds: number }`
  - `ServerEnv` fields: `SITE_URL` (from `NEXT_PUBLIC_SITE_URL`, url), `SUPABASE_URL` (url), `SUPABASE_SERVICE_ROLE_KEY` (non-empty), `TURNSTILE_SITE_KEY` (from `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), `TURNSTILE_SECRET_KEY`, `HASH_SECRET` (min 32 chars), `ADMIN_PASSWORD` (min 8), `ADMIN_SESSION_SECRET` (min 32), `rateLimits: { mint, vote, status, adminLogin: RateLimit }`.
  - Rate-limit env vars `RATE_LIMIT_MINT`, `RATE_LIMIT_VOTE`, `RATE_LIMIT_STATUS` and `RATE_LIMIT_ADMIN_LOGIN` use the format `"max/windowSeconds"`. The defaults are `60/600`, `30/600`, `120/60` and `10/900`.
  - `getSupabaseAdmin(): SupabaseClient<Database>` (in `supabase.ts`, starts with `import 'server-only'`, singleton, `auth: { persistSession: false, autoRefreshToken: false }`). Until Task 5 generates `database.types.ts`, use an untyped client and add the generic in Task 5.

- [ ] **Step 1: Write failing tests** (`valid` = a complete object of valid values)

```ts
test('parses valid env with default rate limits', () => {
  const env = parseServerEnv(valid);
  expect(env.rateLimits.vote).toEqual({ max: 30, windowSeconds: 600 });
  expect(env.rateLimits.mint).toEqual({ max: 60, windowSeconds: 600 });
});
test('custom rate limit', () => {
  expect(parseServerEnv({ ...valid, RATE_LIMIT_VOTE: '5/60' }).rateLimits.vote)
    .toEqual({ max: 5, windowSeconds: 60 });
});
test('rejects malformed rate limit', () => {
  expect(() => parseServerEnv({ ...valid, RATE_LIMIT_VOTE: 'lots' })).toThrow(/RATE_LIMIT_VOTE/);
});
test('lists all missing vars', () => {
  expect(() => parseServerEnv({})).toThrow(/SUPABASE_URL[\s\S]*HASH_SECRET/);
});
test('short HASH_SECRET rejected', () => {
  expect(() => parseServerEnv({ ...valid, HASH_SECRET: 'short' })).toThrow(/HASH_SECRET/);
});
```

- [ ] **Step 2: Run** `npm test -- env` → FAIL
- [ ] **Step 3: Implement** `env.ts` with zod `safeParse`. Build the error from `issues.map(i => i.path.join('.'))`. Then implement `supabase.ts`. `vitest.config.ts` needs `server-only` aliased to an empty module so the library imports in tests.
- [ ] **Step 4: Run** `npm test` → all PASS; `npm run build` → success
- [ ] **Step 5: Commit** — `feat: add validated server env and Supabase admin client`

---

### Task 4: Supabase project, schema migration, seed

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261119000001_init.sql`, `supabase/seed.sql`, `vitest.db.config.ts`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`, `scripts/write-test-env.mjs`

**Interfaces:**
- Produces: tables exactly as spec §6 (`teams`, `voting_config`, `voting_tokens`, `voters`, `votes`, `rate_limits`), index `votes(device_hash, ip_hash)`, and an `updated_at` trigger on `teams`, `voting_config` and `voters`.
- Produces (test helpers in `tests/db/helpers.ts`): `admin` (service-role client), `anon` (anon client), `resetData(): Promise<void>` (deletes votes, voting_tokens, voters, rate_limits; reactivates all teams), `openWindow(opts?: { maxPerDeviceIp?: number }): Promise<void>` (sets `voting_start = now()-1h`, `voting_end = now()+1h`, `is_enabled = true`, cap default 3), `teamId(slug: string): Promise<string>`.
- `scripts/write-test-env.mjs` runs `npx supabase status -o env` and writes `.env.test.local` with `SUPABASE_URL` (from `API_URL`), `SUPABASE_SERVICE_ROLE_KEY` (from `SERVICE_ROLE_KEY`) and `SUPABASE_ANON_KEY` (from `ANON_KEY`). `vitest.db.config.ts` loads it with dotenv, `include: ['tests/db/**/*.test.ts']`, `fileParallelism: false`.

- [ ] **Step 1: Init and start local Supabase**

Run: `npx supabase init` (decline VS Code settings), then `npx supabase start`. Expected: the API URL is printed.
Run: `node scripts/write-test-env.mjs`. Expected: `.env.test.local` is written. Check it's covered by `.gitignore`.

- [ ] **Step 2: Write failing schema tests** (`tests/db/schema.test.ts`)

```ts
test('11 seeded active teams in order', async () => {
  const { data } = await admin.from('teams').select('slug,display_order,is_active').order('display_order');
  expect(data!.map(t => t.slug)).toEqual(Array.from({ length: 11 }, (_, i) => `team-${i + 1}`));
  expect(data!.every(t => t.is_active)).toBe(true);
});
test('voting_config is a single disabled row', async () => {
  const { data } = await admin.from('voting_config').select('*');
  expect(data).toHaveLength(1);
  expect(data![0].is_enabled).toBe(false);
  expect(data![0].max_votes_per_device_ip).toBe(3);
  const { error } = await admin.from('voting_config').insert({ id: 2, voting_start: new Date().toISOString(), voting_end: new Date(Date.now()+1e6).toISOString() });
  expect(error).not.toBeNull();
});
test('config rejects end before start', async () => {
  const { error } = await admin.from('voting_config').update({ voting_start: '2026-01-02T00:00:00Z', voting_end: '2026-01-01T00:00:00Z' }).eq('id', 1);
  expect(error).not.toBeNull();
});
test('duplicate token_hash rejected', async () => {
  const row = { token_hash: 'h1', expires_at: new Date(Date.now()+1e6).toISOString() };
  await admin.from('voting_tokens').insert(row);
  expect((await admin.from('voting_tokens').insert(row)).error?.code).toBe('23505');
});
test('anon is locked out', async () => {
  for (const t of ['teams','votes','voters','voting_tokens','voting_config','rate_limits']) {
    const { data } = await anon.from(t).select('*');
    expect(data ?? []).toHaveLength(0);
  }
});
```
`beforeEach(resetData)`.

- [ ] **Step 3: Run** `npm run test:db` → FAIL (tables missing)

- [ ] **Step 4: Write the migration and seed**

`20261119000001_init.sql`: `create extension if not exists pgcrypto`; tables per spec §6, with columns, defaults, `check`s and `unique`s exactly as listed there. `votes.team_id` has `on delete restrict`. Add the `set_updated_at()` trigger function and its triggers. Run `alter table … enable row level security` on all six tables, and `revoke all on all tables in schema public from anon, authenticated`.
`seed.sql`: 11 teams, with `accent_color` values from a fixed palette of 11 distinct hex colours and `logo_url` null. One `voting_config` row: `voting_start = '2026-11-21 09:00+05:30'`, `voting_end = '2026-11-22 21:00+05:30'`, `is_enabled = false`.

- [ ] **Step 5: Apply** `npm run db:reset` → migrations and seed apply without error
- [ ] **Step 6: Run** `npm run test:db` → PASS
- [ ] **Step 7: Commit** — `feat(db): add schema, RLS lockdown and team seed`

---

### Task 5: Voting functions + generated types

**Files:**
- Create: `supabase/migrations/20261119000002_functions.sql`, `tests/db/functions.test.ts`, `src/lib/database.types.ts` (generated)
- Modify: `src/lib/supabase.ts` (add the `Database` generic)

**Interfaces (all `language plpgsql security definer set search_path = public`; `revoke execute … from public, anon, authenticated`; `grant execute … to service_role`):**
- `voting_state() returns text` — returns `'open'` | `'before'` | `'closed'`. It returns `closed` if `now() >= voting_end`, `open` if enabled and `now() >= voting_start`, and `before` otherwise.
- `mint_token(p_token_hash text, p_ip_hash text, p_ttl_seconds int default 7200) returns text`. It returns `'ok'` (and inserts a token with `expires_at = least(now() + ttl, voting_end)`), `'voting_not_open'` or `'voting_closed'`.
- `cast_vote(p_token_hash text, p_team_id uuid, p_browser_id_hash text, p_device_hash text, p_ip_hash text, p_user_agent_hash text) returns table(status text, team_id uuid, team_name text)`.
  - `status` is one of `ok`, `voting_not_open`, `voting_closed`, `token_invalid`, `token_used`, `invalid_team`, `already_voted`.
  - **Check order:**
    1. Voting state.
    2. Token: `select … for update`. Missing, `revoked`, `expired`, or `expires_at <= now()` gives `token_invalid`. When `expires_at` has passed, also set its status to `expired`. `used` gives `token_used`.
    3. Team exists and is active, else `invalid_team`. The token stays active.
    4. Upsert the voter on `browser_id_hash` (update `last_seen_at`, `ip_hash` and `user_agent_hash`).
    5. The voter already has a vote: `already_voted`.
    6. If cap > 0 and there are at least cap votes with this `(device_hash, ip_hash)` (both non-null): `already_voted`.
    7. Insert the vote, mark the token `used` with `used_at = now()`, and return `ok` with the team.
  - Catch `unique_violation` on the insert and return `already_voted`.
- `get_voter_vote(p_browser_id_hash text) returns table(team_id uuid, team_name text)` — 0 or 1 rows.
- `rate_limit_hit(p_bucket text, p_key_hash text, p_window_seconds int, p_max int) returns boolean`. It uses a fixed window: `window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)`. Upsert with `count + 1 … returning count`, then return `count <= p_max`. On about 1% of calls (`random() < 0.01`), delete rows older than 1 hour.
- `get_results() returns table(team_id uuid, name text, slug text, logo_url text, accent_color text, votes bigint, percent numeric, rank int)`. It covers active teams only, including teams with 0 votes. `percent` is `round(100.0 * votes / nullif(total, 0), 1)`, coalesced to 0. `rank` is `rank() over (order by votes desc)`. Rows are ordered by `votes desc, display_order`.

- [ ] **Step 1: Write failing tests** (`tests/db/functions.test.ts`)

Helpers in the test file: `mint(hash = randomHex())` calls `mint_token`, and `vote(tokenHash, slug, browser, device = 'd1', ip = 'i1')` calls `cast_vote` and returns its first row. `beforeEach(resetData)`.

```ts
test('voting_state: disabled before end → before; past end → closed; open window → open', ...)
  // set config rows directly, assert rpc('voting_state') values: 'before', 'closed' (end in past, enabled=true), 'open'
test('mint refused when not open', async () => { expect(await mintRaw('t')).toBe('voting_not_open'); });
test('mint expiry capped at voting_end', ...)            // openWindow with end = now()+10min; ttl 7200 → expires_at <= voting_end
test('happy path vote', async () => {
  await openWindow(); await mint('t1');
  const r = await vote('t1', 'team-3', 'b1');
  expect(r).toMatchObject({ status: 'ok', team_name: 'Team 3' });
  expect((await admin.from('voting_tokens').select('status').eq('token_hash','t1')).data![0].status).toBe('used');
});
test('reused token → token_used', ...)                    // second vote with t1, browser b2 → 'token_used'
test('unknown token → token_invalid', ...)
test('rejects time-expired token', ...)                   // insert token with expires_at past, status active → 'token_invalid'; row status now 'expired'
test('invalid team leaves token active', ...)             // inactive team-5 → 'invalid_team'; retry with team-1 → 'ok'
test('same browser second token → already_voted', ...)
test('device+ip cap 3', ...)                              // b1..b3 same d1/i1 ok, b4 → 'already_voted'; b5 with ip 'i2' → 'ok'
test('cap 0 disables device check', ...)                  // openWindow({maxPerDeviceIp:0}); 5 browsers same device/ip → all 'ok'
test('closed window rejects vote', ...)                   // mint while open, then set end to past → 'voting_closed'
test('cast_vote concurrency', async () => {
  await openWindow(); await mint('tc');
  const rs = await Promise.all([1,2,3,4,5].map(i => vote('tc', 'team-1', `bc${i}`, `dc${i}`, `ic${i}`)));
  expect(rs.filter(r => r.status === 'ok')).toHaveLength(1);
  expect(rs.filter(r => r.status === 'token_used')).toHaveLength(4);
  expect((await admin.from('votes').select('id')).data).toHaveLength(1);
});
test('get_voter_vote', ...)                               // after happy path: [{team_name:'Team 3'}]; unknown browser: []
test('rate_limit_hit', async () => {
  const hit = () => admin.rpc('rate_limit_hit', { p_bucket: 'x', p_key_hash: 'k', p_window_seconds: 600, p_max: 2 });
  expect([(await hit()).data, (await hit()).data, (await hit()).data]).toEqual([true, true, false]);
});
test('get_results ranks, percents, includes zero-vote teams, excludes inactive', ...)
  // 3 votes team-2, 1 vote team-7, team-11 inactive → 10 rows; first team-2 rank 1 votes 3 percent 75.0; team-7 rank 2 percent 25.0; zero-vote teams percent 0, tied rank 3
test('anon cannot rpc', async () => {
  for (const fn of ['get_results','voting_state'])
    expect((await anon.rpc(fn as any)).error).not.toBeNull();
});
```
Each `...` test above is written out in full by the implementer, with the assertions given in its comment.

- [ ] **Step 2: Run** `npm run test:db` → FAIL (functions missing)
- [ ] **Step 3: Implement** the functions migration per the interfaces above.
- [ ] **Step 4: Apply and test** — `npm run db:reset`, then `npm run test:db` → all PASS (rerun once to confirm no flakiness from the concurrency test).
- [ ] **Step 5: Generate types** — `npm run db:types`, add the `Database` generic to `getSupabaseAdmin`, then `npm run build` → success, `npm test` → PASS.
- [ ] **Step 6: Commit** — `feat(db): add atomic vote, mint, rate-limit and results functions`

---

### Task 6: README and hosted-project checklist

**Files:**
- Create: `README.md` (replace generated)

- [ ] **Step 1: Write the README.** Cover local setup (`npm i`, `npm run db:start`, `node scripts/write-test-env.mjs`, `npm test`, `npm run test:db`, `npm run dev`). Add a checklist for going live:
  1. Create a free Supabase project.
  2. `npx supabase link --project-ref …` then `npx supabase db push`.
  3. Run `seed.sql` once in the SQL editor.
  4. Create a Turnstile widget for `<project>.vercel.app` and `localhost`.
  5. Set the Vercel env vars from `.env.example`.
  6. Deploy.

  End with an "Instagram/HeyDM link" note: the DM link is `https://<host>/v`.
- [ ] **Step 2: Verify** — `npm test`, `npm run test:db`, `npm run lint` and `npm run build` all succeed.
- [ ] **Step 3: Commit** — `docs: add setup and go-live checklist`
