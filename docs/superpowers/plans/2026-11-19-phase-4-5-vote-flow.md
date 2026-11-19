# Doc IPL Voting — Phase 4+5 (Working Vote Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voting works end to end. The DM link `/v` mints a single-use ballot and sets the voter cookie. The ballot checks its token, runs Turnstile and sends a device signal. `POST /api/vote` validates everything server-side and records the vote. `/thanks` shows the voter's team, and a repeat visit lands on "already voted".

**Why 4+5 together:** the vote API can't be exercised without tokens from `/v` and the voter cookie, so the original Phase 4 and Phase 5 are delivered as one plan.

**Architecture:** Route handlers (`src/app/v/route.ts`, `src/app/api/vote/route.ts`) are thin. They use `NextRequest`/`NextResponse` cookies (no `next/headers`), so integration tests can call them directly with a `NextRequest` against the local DB. Turnstile verification sits in its own module, which tests mock. All DB access goes through `src/lib/votes.ts` wrappers around the SQL functions. Identity values are always HMAC-hashed before they reach the DB.

**Tech Stack:** Next.js 16 route handlers, Supabase RPC, Cloudflare Turnstile (explicit render), Web Crypto (device signal), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md` (§4 flow, §5 anti-abuse). Carry-forward rules: `docs/superpowers/notes/phase-3-plus-carry-forward.md`, especially "Vote API / anti-abuse" and "From Phase 3 final review".

## Global Constraints

- Voter cookie: name `dipl_vid`; value `randomToken()` (32 bytes, base64url); `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` only when `NODE_ENV === 'production'`; `maxAge` = seconds until `voting_end + 7 days` (minimum 1 day).
- Hashes stored in the DB:
  - `token_hash = sha256Hex(token)`
  - `browser_id_hash = hashId(cookie)`
  - `ip_hash = hashId(ip)`
  - `device_hash = hashId(deviceSignal)`
  - `user_agent_hash = hashId(ua)`
  - Here `hashId(v) = hmacHex(HASH_SECRET, v)`. Raw values are never stored or logged.
- Client IP: first entry of `x-forwarded-for` (trimmed), else `x-real-ip`, else `null`. If it's null, use the literal `'unknown'` for hashing and `console.warn('[vote] no client IP header')` once per request.
- Rate limits use `getServerEnv().rateLimits` buckets: `mint` for GET `/v`, `vote` for POST `/api/vote`. The key is the ip hash. An RPC error is a failure (500), never ignored.
- `/api/vote` JSON contract:
  - Success: `200 { ok: true, teamName: string }`.
  - Errors: `{ ok: false, code }` with `code` from `VOTE_ERROR_CODES`:
    - 400 for `invalid_team`/`token_invalid` on a malformed body
    - 429 `rate_limited`
    - 403 `turnstile_failed`
    - 409 `already_voted`
    - 403 `voting_not_open`/`voting_closed`
    - 410 `token_invalid`
    - 422 `invalid_team`
    - 500 `network` on an unexpected server error
  - DB `token_used` maps to `already_voted`. The response never says which duplicate signal fired.
- Check order in `/api/vote`: parse body → rate limit → Turnstile → `cast_vote` (which itself checks window → token → team → voter → cap).
- Turnstile: verify server-side at `https://challenges.cloudflare.com/turnstile/v0/siteverify` (form-encoded `secret`, `response`, `remoteip`), and accept only `success === true`. An empty token fails without calling Cloudflare. Local and dev use the test keys `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`.
- Every link to `/v` stays a plain `<a>` (no `next/link`).
- `cacheComponents: true`: pages reading cookies or the DB do it in an async child under `<Suspense>` after `await connection()`.
- Mobile-only UI. Copy for new screens is given in the tasks verbatim.
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The same token posted twice concurrently through the API** gives exactly one `ok` and one `already_voted`. Test: `api: concurrent same token` (Task 4).
2. **A voter cookie that has already voted, hitting `/v` again,** is redirected to `/thanks` without minting a token. Test: `v: voted cookie → /thanks, no new token` (Task 3).
3. **"Open in Safari" (a valid token with no cookie)** can still vote once. The API issues a new cookie, and the response sets `dipl_vid`. Test: `api: no cookie → vote ok and cookie set` (Task 4).
4. **A failed Turnstile** never consumes the token: the token stays `active`. Test: `api: turnstile fail keeps token active` (Task 4).
5. **Refreshing `/vote/<used token>`** goes to `/thanks`, and `/thanks` without a vote goes to `/`. Tests: `token state` (Task 1) plus the page checks in the controller's Playwright pass.

---

### Task 1: Token-state SQL function

**Files:**
- Create: `supabase/migrations/20261119000003_token_state.sql`
- Modify: `src/lib/database.types.ts` (regenerated)
- Test: `tests/db/functions.test.ts` (append)

**Interfaces:**
- `get_token_state(p_token_hash text) returns text`. It returns `'active'` when the row exists with `status='active'` and `expires_at > now()`, `'used'` when `status='used'`, and `'invalid'` otherwise (missing, revoked, expired, or past `expires_at`). It is `stable`, `security definer`, `set search_path = public`; execute is revoked from public, anon and authenticated, and granted to service_role.

- [ ] **Step 1:** Add the test `token state` to the functions tests. Mint a token, check it's `active`, vote with it, then check `used`. An unknown hash gives `invalid`. A row inserted with a past `expires_at` gives `invalid`. Add `get_token_state` to the existing `anon cannot rpc` list.
- [ ] **Step 2:** Run `npm run test:db` → FAIL. **Step 3:** Write the migration, then `npm run db:reset`.
- [ ] **Step 4:** Run `npm run test:db` → PASS. Then `npm run db:types`, `npm run build` → OK.
- [ ] **Step 5:** Commit — `feat(db): token state lookup`

---

### Task 2: Server identity, Turnstile and DB wrappers

**Files:**
- Create: `src/lib/clientIp.ts`, `src/lib/voterCookie.ts`, `src/lib/identity.ts`, `src/lib/turnstile.ts`, `src/lib/votes.ts`
- Test: `tests/clientIp.test.ts`, `tests/voterCookie.test.ts`, `tests/turnstile.test.ts`, `tests/db/votes.test.ts`

**Interfaces:**
- `clientIp.ts` (pure): `getClientIp(headers: Headers): string | null`.
- `voterCookie.ts` (pure):
  - `VOTER_COOKIE = 'dipl_vid'`
  - `voterCookieOptions(votingEnd: Date, now?: Date, isProd?: boolean): { httpOnly: true; sameSite: 'lax'; path: '/'; secure: boolean; maxAge: number }`. `isProd` defaults to `process.env.NODE_ENV === 'production'`.
- `identity.ts` (server-only): `hashId(value: string): string` (HMAC with `getServerEnv().HASH_SECRET`), `hashToken(token: string): string` (= `sha256Hex`).
- `turnstile.ts` (server-only): `verifyTurnstile(token: string, ip: string | null, fetchImpl?: typeof fetch): Promise<boolean>`. It returns false for an empty token without fetching, false on any network or parse error, and otherwise `json.success === true`.
- `votes.ts` (server-only; every function throws on an RPC error):
  - `rateLimitHit(bucket: 'mint' | 'vote', keyHash: string): Promise<boolean>`: reads `max` and `windowSeconds` from env `rateLimits[bucket]` and returns `true` if allowed.
  - `mintToken(tokenHash: string, ipHash: string): Promise<'ok' | 'voting_not_open' | 'voting_closed'>`
  - `type CastStatus = 'ok' | 'voting_not_open' | 'voting_closed' | 'token_invalid' | 'token_used' | 'invalid_team' | 'already_voted'`
  - `castVote(a: { tokenHash: string; teamId: string; browserHash: string; deviceHash: string | null; ipHash: string; uaHash: string | null }): Promise<{ status: CastStatus; teamName: string | null }>`
  - `getVoterVote(browserHash: string): Promise<{ teamId: string; teamName: string } | null>`
  - `getTokenState(tokenHash: string): Promise<'active' | 'used' | 'invalid'>`

- [ ] **Step 1: Failing tests**

```ts
// clientIp
expect(getClientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4');
expect(getClientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
expect(getClientIp(new Headers())).toBeNull();
// voterCookie
const end = new Date('2026-11-22T15:30:00Z'), now = new Date('2026-11-21T15:30:00Z');
expect(voterCookieOptions(end, now, true)).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 8 * 86400 });
expect(voterCookieOptions(new Date('2026-01-01T00:00:00Z'), now, false).maxAge).toBe(86400); // floor 1 day
// turnstile (fetchImpl stub)
test('empty token → false without fetch', ...)
test('success true → true; posts secret, response, remoteip form-encoded to siteverify', ...)
test('success false → false', ...)
test('fetch throws → false', ...)
// tests/db/votes.test.ts (beforeEach resetData)
test('rateLimitHit allows then blocks per env limit', ...) // vi.stubEnv RATE_LIMIT_VOTE='2/600' before first getServerEnv use, or call with a bucket whose test-env limit is set in vitest.db.config.mts env: RATE_LIMIT_VOTE: '2/600' → true,true,false
test('mint + cast + getVoterVote + getTokenState round trip', ...) // openWindow; mintToken → 'ok'; getTokenState 'active'; castVote ok teamName 'Code Red'; getTokenState 'used'; getVoterVote → {teamName:'Code Red'}
test('castVote maps token_used', ...)
test('mintToken when closed → voting_not_open', ...)
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Put `RATE_LIMIT_VOTE: '2/600'` in the `env` of `vitest.db.config.mts` so the limit is deterministic, and keep the other defaults.
- [ ] **Step 4:** Run `npm test` and `npm run test:db` → PASS; `npm run lint` and `npm run build` → OK.
- [ ] **Step 5:** Commit — `feat: identity hashing, turnstile verification and vote DB wrappers`

---

### Task 3: `/v` mint-and-redirect route + slow-down page

**Files:**
- Create: `src/app/v/route.ts`, `src/app/slow-down/page.tsx`
- Test: `tests/db/route-v.test.ts`

**Interfaces:**
- `GET(req: NextRequest): Promise<NextResponse>` in `src/app/v/route.ts`. Every outcome is a `303` redirect built with `new URL(path, req.url)`.
  1. `ip = getClientIp(req.headers)`, `ipHash = hashId(ip ?? 'unknown')`. If `!(await rateLimitHit('mint', ipHash))`, redirect to `/slow-down`.
  2. `getVotingStatus()`. If the state isn't `open`, redirect to `/`.
  3. `cookie = req.cookies.get(VOTER_COOKIE)?.value`. If it's present and `getVoterVote(hashId(cookie))` isn't null, redirect to `/thanks` with no mint.
  4. Otherwise `cookie ??= randomToken()`. `token = randomToken()`, then `mintToken(hashToken(token), ipHash)`. If that isn't `'ok'`, redirect to `/`.
  5. Redirect to `/vote/${token}`.
  - Every redirect that has a cookie value (existing or new) sets `dipl_vid` with `voterCookieOptions(end)`.
  - Add `export const dynamic = 'force-dynamic'` only if the build requires it under `cacheComponents`. Prefer no export; check with `npm run build`.
- `/slow-down` is a static page. Centred, matching the StatusScreen look. Title `Too many attempts.`, body `Please wait a minute and try again.`, and a plain `<a href="/v">` primary button `TRY AGAIN`.

- [ ] **Step 1: Failing integration tests** (call `GET(new NextRequest('http://localhost:3000/v', { headers }))` directly; `beforeEach(resetData)`)

```ts
test('v: closed → / and no token', ...)                     // seed config disabled → 303 Location ends with '/', voting_tokens count 0
test('v: open, no cookie → /vote/<token>, sets cookie, token active', ...) // Location matches /\/vote\/[A-Za-z0-9_-]{43}$/; set-cookie contains 'dipl_vid=' and 'HttpOnly' and 'SameSite=lax'; get_token_state(sha256(token)) = 'active'
test('v: existing cookie reused', ...)                      // request with Cookie dipl_vid=abc… → response cookie value unchanged
test('v: voted cookie → /thanks, no new token', ...)        // mint+vote for cookie X via helpers/castVote, then GET with cookie X → /thanks; token count unchanged
test('v: rate limited → /slow-down', ...)                   // set RATE_LIMIT_MINT '2/600' in db vitest env; third call from same x-forwarded-for → /slow-down
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm run test:db`, `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat: /v ballot minting route and slow-down page`

---

### Task 4: `POST /api/vote`

**Files:**
- Create: `src/app/api/vote/route.ts`
- Test: `tests/db/route-vote.test.ts`

**Interfaces:**
- `POST(req: NextRequest): Promise<NextResponse>`:
  1. Parse the body with zod: `{ token: string 20–200 chars, teamId: string uuid, turnstileToken: string ≤ 4096, deviceSignal: string ≤ 256 | null }`. JSON parse failure or schema failure → 400. Use `invalid_team` if only `teamId` is bad, else `token_invalid`.
  2. `ip` and `ipHash` as in `/v`. If `rateLimitHit('vote', ipHash)` is false → 429 `rate_limited`.
  3. If `!(await verifyTurnstile(turnstileToken, ip))` → 403 `turnstile_failed`.
  4. `cookie = req.cookies.get(VOTER_COOKIE)?.value ?? randomToken()`.
  5. `castVote({ tokenHash: hashToken(token), teamId, browserHash: hashId(cookie), deviceHash: deviceSignal ? hashId(deviceSignal) : null, ipHash, uaHash: ua ? hashId(ua) : null })`.
  6. Map the status to the contract in Global Constraints. If `ok` has a null `teamName`, return 500 `network`.
  7. Always set the `dipl_vid` cookie (`voterCookieOptions` with the voting end from `getVotingStatus()`) on 200, 409 and 410 responses.
  8. Wrap everything in try/catch: an unexpected error → 500 `network` and `console.error` (no secrets or raw identifiers).

- [ ] **Step 1: Failing integration tests** (`vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: vi.fn(async (t: string) => t === 'pass') }))`; helper `mintFor(cookie?)` uses `GET` from `/v` to get a token and a cookie; `post(body, {cookie, ip})` calls `POST(new NextRequest(...))`)

```ts
test('api: happy path', ...)                        // 200 {ok:true, teamName:'Code Red'}; token now 'used'
test('api: no cookie → vote ok and cookie set', ...)// set-cookie has dipl_vid
test('api: reused token → 409 already_voted', ...)
test('api: same cookie, second token → 409 already_voted', ...)
test('api: turnstile fail keeps token active', ...) // turnstileToken 'nope' → 403 turnstile_failed; get_token_state 'active'
test('api: bad teamId → 400 invalid_team; bad token shape → 400 token_invalid; non-JSON → 400 token_invalid', ...)
test('api: inactive team → 422 invalid_team, token still active', ...)
test('api: unknown token → 410 token_invalid', ...)
test('api: closed window → 403 voting_closed', ...) // mint while open, then set voting_end past
test('api: rate limited → 429', ...)                // db env RATE_LIMIT_VOTE '2/600' → third post from same ip = 429 (use distinct tokens)
test('api: concurrent same token', ...)             // Promise.all two posts same token, different cookies → one 200, one 409
test('api: device cap via API', ...)                // openWindow cap 1; two different cookies+tokens, same ip + same deviceSignal → 200 then 409
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm run test:db`, `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat: vote API with server-side validation`

---

### Task 5: Ballot token checks, cookie-aware thank-you, error page

**Files:**
- Modify: `src/app/vote/[token]/page.tsx`, `src/app/thanks/page.tsx`
- Create: `src/app/error.tsx`, `src/components/ExpiredBallot.tsx`
- Test: `tests/ExpiredBallot.test.tsx`

**Interfaces / behaviour:**
- `/vote/[token]`: `export const metadata = { title: 'Vote — Doc IPL People\'s Choice' }`. Inside the async child, after `connection()`:
  1. If the state isn't `open`, show `StatusScreen` (as now).
  2. Read the `dipl_vid` cookie via `cookies()` from `next/headers`. If it's present and `getVoterVote(hashId(cookie))` is set, `redirect('/thanks')`.
  3. `getTokenState(hashToken(token))`: `'used'` → `redirect('/thanks')`; `'invalid'` → `<ExpiredBallot />`.
  4. If `getActiveTeams()` is empty, show a centred `No teams are available right now.`
  5. Otherwise show `<BallotClient …>`.
- `<ExpiredBallot />`: centred, StatusScreen look. Title `This ballot link has expired.`, body `Get a new ballot to vote.`, a plain `<a href="/v">` primary button `GET A NEW BALLOT`, and the Privacy link.
- `/thanks`: an async child under Suspense, after `connection()`, reads the cookie. If there's no cookie or no vote, `redirect('/')`. Otherwise `<ThankYou teamName={vote.teamName} />`.
- `app/error.tsx` (`'use client'`): centred. Title `Something went wrong.`, body `Please try again in a moment.`, and a primary button `TRY AGAIN` that calls `reset()`.

- [ ] **Step 1:** Write the failing test: ExpiredBallot renders the copy, and its link is an `A` with href `/v`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(ui): token-aware ballot, cookie-aware thank-you, error page`

---

### Task 6: Turnstile widget, device signal and ballot wiring

**Files:**
- Create: `src/lib/deviceSignal.ts`, `src/components/TurnstileWidget.tsx`
- Modify: `src/components/BallotForm.tsx`, `src/app/vote/[token]/BallotClient.tsx`, `src/app/vote/[token]/page.tsx` (pass the site key)
- Test: `tests/deviceSignal.test.ts`, `tests/BallotForm.test.tsx` (extend)

**Interfaces:**
- `deviceSignal.ts` (client): `collectDeviceSignal(): Promise<string | null>`. It collects:
  - `navigator.userAgent`, `navigator.language`, `navigator.platform`, `navigator.hardwareConcurrency`, `navigator.maxTouchPoints`
  - `screen.width`×`height`×`colorDepth`, `devicePixelRatio`
  - the `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - a canvas fingerprint: draw text `DocIPL🏓` with a fillRect, then `toDataURL()`. Skip it if canvas is unavailable.

  It joins the parts with `|` and returns the SHA-256 hex via `crypto.subtle`. Any thrown error returns `null`.
- `<TurnstileWidget siteKey: string; onToken: (t: string | null) => void; resetSignal: number />` (`'use client'`):
  - Loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once, using `next/script` or manual injection.
  - Renders with `{ sitekey, appearance: 'interaction-only', 'refresh-expired': 'auto', callback: onToken, 'expired-callback': () => onToken(null), 'error-callback': () => onToken(null) }`.
  - Calls `turnstile.reset(widgetId)` and `onToken(null)` whenever `resetSignal` changes after mount.
  - Removes the widget on unmount.
- `BallotForm` gets new optional props:
  - `canSubmit?: boolean` (default `true`). When a team is selected but `!canSubmit`, the button is disabled and reads `Verifying…`.
  - `onSubmitFailed?: () => void`, called after every non-ok result.
  - `footerExtra?: ReactNode`, rendered in the sticky footer above the button.
- `BallotClient({ token, teams, siteKey })` holds the Turnstile token state and a `resetSignal` counter (incremented in `onSubmitFailed`). It renders the widget through `footerExtra`. Its `submit` collects the device signal once (memoised promise) and then calls `postVote({ token, teamId, turnstileToken, deviceSignal })`.
- The page passes `siteKey={getServerEnv().TURNSTILE_SITE_KEY}`.

- [ ] **Step 1: Failing tests**

```ts
// deviceSignal (jsdom)
test('returns 64-hex string and is stable across calls', ...)
test('returns null when crypto.subtle throws', ...)   // vi.spyOn(crypto.subtle,'digest').mockRejectedValue(...)
// BallotForm
test('canSubmit=false shows Verifying… and blocks submit', ...)
test('onSubmitFailed called after error result', ...)
test('footerExtra rendered', ...)
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run lint` and `npm run build` → pass. Smoke check with `npm run dev`: `/v` (voting enabled in the local DB) redirects to a ballot with the Turnstile test widget, and voting reaches `/thanks` with the team name.
- [ ] **Step 5:** Commit — `feat: Turnstile, device signal and live ballot submission`

---

## After all tasks: controller end-to-end Playwright pass (390×844)

With `.env.local` holding the Turnstile test keys and voting enabled locally:
1. `/` shows "Voting is open!", and VOTE NOW (`/v`) goes to `/vote/<token>`.
2. Select a team and submit → `/thanks` shows "You voted for: <team>".
3. Refresh `/thanks` → still the team. Back button → not the ballot.
4. `/v` again → `/thanks` (no new ballot).
5. Reopen the old `/vote/<token>` URL → `/thanks`.
6. Clear cookies and open the old token URL → `/thanks`, because the token is used.
7. Clear cookies, then `/v` → a new ballot. Voting gives `already_voted` only if the device cap is hit (cap 3: the 4th fresh-cookie vote from the same browser is blocked).
8. `/vote/garbage` → the expired-ballot screen.
9. `/thanks` with no cookie → `/`.
10. Disable voting → `/v` → `/` shows "Voting is paused."
