# Doc IPL People's Choice Voting — Design

Date: 2026-11-19
Status: Draft for approval

## 1. Intent

Doc IPL (a pickleball league mostly for doctors, 11 teams) wants a "Most Popular Team" vote over one weekend. Voters come from Instagram: they comment "VOTE" on a post or Reel, **HeyDM** sends them a DM (after a follower gate), and the DM contains one link to this app. The vote should take under 30 seconds on a phone. It should stop casual repeat voting and bots. It does not need to verify who anyone is.

The original brief (the pasted spec) still applies except where this document changes it. The main change is that **the DM link is the same for every user.** HeyDM can't make a separate link per person, and it has no webhooks or outgoing requests, so the app can't learn the voter's Instagram identity.

## 2. Goals, non-goals, anti-goals

**Goals**
- DM link → vote → thank-you in under 30 seconds on mobile Safari or Chrome Android, including Instagram's in-app browser.
- One vote per browser, enforced on the server; reusing a ballot link is impossible.
- Bots and scripted mass voting are blocked: Turnstile, limits per IP, and a cap per device and network.
- A public leaderboard showing only totals per team.
- A small password-protected admin area for teams, the voting window, results and CSV export.
- No personal data collected. Technical identifiers are hashed with a secret key before they're stored.

**Non-goals**
- Instagram automation, which HeyDM handles.
- One vote per Instagram account. This can't be done with a link that's the same for everyone; using several accounts is accepted.
- SMS or email verification, user accounts, roles, analytics.

**Anti-goals (failure even if it "works")**
- Real doctors on shared hospital Wi-Fi get blocked.
- Different people with the same iPhone model get blocked as "the same device" (see 5.4).
- The voting page loads slowly or needs anything typed in.
- Any voter-level data reachable from a public endpoint.

## 3. Approaches considered

| | Approach | Verdict |
|---|---|---|
| A | DM tool calls our API for each person to get a token tied to their Instagram ID (needs ManyChat External Request) | Best protection, but ManyChat Pro charges per contact beyond 250. **Rejected on cost.** |
| B | Put the Instagram user ID or username straight into the DM link | Anyone can edit the URL to vote as made-up users. **Rejected.** |
| C | **Generic link → server makes a single-use token → redirect to `/vote/<token>`**, with cookie, device, IP, Turnstile and database checks | Works with HeyDM. Protection is "one per browser", not "one per person". **Chosen.** |

How the duplicate protection works in C: the generic link can be opened any number of times. Each open makes a new token. **The single-use token stops a ballot being replayed** (refresh, back button, a forwarded `/vote/<token>` URL). **The voter cookie, device signal, Turnstile and limits stop repeat voting.**

## 4. User flow

```
HeyDM DM button → https://vote.docipl.com/v            (same for everyone)

GET /v   (route handler, no UI)
  1. rate-limit by IP (mint bucket)
  2. load voting_config → not open? redirect "/"  (shows "opens soon" / "closed")
  3. read cookie dipl_vid → if missing, generate one
  4. voter already has a vote? → redirect /thanks
  5. create voting_token (random, hash stored, expires min(now+2h, voting_end))
  6. Set-Cookie dipl_vid; 303 redirect → /vote/<token>

GET /vote/<token>   (ballot page, server-rendered)
  - token unknown/expired/revoked → "This ballot link has expired" + [Get a new ballot] → /v
  - token used → redirect /thanks
  - window closed → closed screen
  - else render 11 team cards + Turnstile widget + [CAST MY VOTE]

POST /api/vote  { token, teamId, turnstileToken, deviceSignal }
  1. validate body shape (zod)
  2. rate-limit by IP (vote bucket)
  3. verify Turnstile with Cloudflare (server-side secret, include remoteip)
  4. call DB function cast_vote(...) — atomic, does everything below in one transaction:
       window open & enabled → token active, not expired (row lock) → team active
       → upsert voter by browser hash → voter has no vote
       → count votes with same (device_hash, ip_hash) < cap
       → insert vote → mark token used
  5. map result → JSON { ok:true, team } or { ok:false, code }
  6. client navigates to /thanks (replace, so Back doesn't return to the ballot)

GET /thanks   → reads dipl_vid cookie → "You voted for TEAM" + [VIEW LIVE RESULTS]
GET /results  → aggregated leaderboard, refreshes every 15s
```

Error codes returned to the client (copy shown to the user in brackets):
`already_voted` ("You've already voted! Each person can vote only once."), `voting_not_open`, `voting_closed`, `token_invalid` ("This ballot link has expired." + new-ballot button), `invalid_team`, `turnstile_failed` ("Please try again."), `rate_limited` ("Too many attempts, wait a minute."). The response never says *which* duplicate signal fired: the cookie, the device cap or the token all return `already_voted`.

**If the user taps "Open in Safari" from the Instagram browser:** Safari gets `/vote/<token>` without the cookie. That's allowed. On POST a new `dipl_vid` is issued, and the token is still single-use, so only one vote comes out of that token.

## 5. Anti-abuse mechanisms

### 5.1 Voting token
- 32 random bytes from `crypto.randomBytes`, base64url (43 chars).
- Stored as `sha256(token)`; the raw token exists only in the URL.
- Status: `active | used | expired | revoked`. Expiry = `min(now + 2h, voting_end)`.
- Made only by `GET /v` (and the admin "test ballot" button, which just opens `/v`). No external token API is needed, because HeyDM can't call one.

### 5.2 Voter cookie
- `dipl_vid` = 32 random bytes, base64url. Flags: `HttpOnly; Secure; SameSite=Lax; Path=/`. Max-Age lasts until 7 days after `voting_end`.
- The database stores only `HMAC-SHA256(HASH_SECRET, value)` in `voters.browser_id_hash` (unique).
- **Hard rule: one vote per voter** (`votes.voter_id UNIQUE`).

### 5.3 IP
- The client IP comes from `x-forwarded-for` (first hop, set by Vercel). It's stored only as `HMAC(HASH_SECRET, ip)`. Using HMAC rather than a plain hash means someone can't reverse IPv4 addresses by trying them all.
- Used for rate limiting and as half of the device-and-network cap. **Never a hard block on its own.**

### 5.4 Device signal and its limits
The client sends a small fingerprint: a hash of UA, screen size and pixel ratio, timezone, language, platform, `hardwareConcurrency`, touch support and a canvas hash. The server stores it as an HMAC.

**Finding:** on iPhones these values are almost identical for everyone with the same model and iOS version, and all voters share the IST timezone and English. So "same device signal" doesn't mean "same person". Blocking on the signal alone would block many real voters.

**Rule:** count earlier votes with the same `(device_hash, ip_hash)` pair. Reject if the count is at least `voting_config.max_votes_per_device_ip`. The **default is 3**, and admin can change it (0 = off). This catches one person clearing cookies on one phone on one network, while tolerating a few same-model iPhones on hospital Wi-Fi.

### 5.5 Rate limits (Postgres, no Redis)
Table `rate_limits(bucket, key_hash, window_start, count)`. An SQL function `rate_limit_hit(bucket, key_hash, window_seconds, max)` adds to a fixed window counter and returns allowed or denied. Limits come from env vars, and the defaults are generous for shared Wi-Fi:

| Bucket | Default |
|---|---|
| `mint` (GET /v) | 60 per IP per 10 min |
| `vote` (POST /api/vote) | 30 per IP per 10 min |
| `status` (GET /api/vote-status) | 120 per IP per min |
| `admin_login` | 10 per IP per 15 min |

Old rows are deleted as they're used (any window older than an hour gets deleted). Vercel's own firewall or Cloudflare can be added in front if needed.

### 5.6 Turnstile
The widget is in managed or invisible mode on the ballot page. The server calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret and `remoteip`, and checks `success` and `hostname`. Each Turnstile token is single-use (Cloudflare enforces this). The secret lives only in the server environment.

### 5.7 Database as source of truth
All voting checks run inside one `SECURITY DEFINER` Postgres function, `cast_vote`, with a lock on the token row. Two simultaneous submits of the same token can't both succeed. Unique constraints back it up: `voting_tokens.token_hash`, `voters.browser_id_hash`, `votes.token_id`, `votes.voter_id`.

## 6. Data model (Supabase Postgres)

```sql
teams(
  id uuid pk default gen_random_uuid(),
  name text not null, slug text unique not null,
  logo_url text, accent_color text,            -- hex, optional
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now())

voting_config(                                  -- exactly one row
  id int pk default 1 check (id = 1),
  voting_start timestamptz not null,
  voting_end   timestamptz not null check (voting_end > voting_start),
  is_enabled boolean not null default false,
  max_votes_per_device_ip int not null default 3,
  updated_at timestamptz default now())

voting_tokens(
  id uuid pk, token_hash text unique not null,
  status text not null default 'active' check (status in ('active','used','expired','revoked')),
  created_at timestamptz default now(), expires_at timestamptz not null, used_at timestamptz,
  ip_hash text)                                  -- for abuse review only

voters(
  id uuid pk, browser_id_hash text unique not null,
  ip_hash text, user_agent_hash text,
  first_seen_at timestamptz default now(), last_seen_at timestamptz default now(),
  created_at timestamptz default now(), updated_at timestamptz default now())

votes(
  id uuid pk,
  team_id uuid not null references teams(id),
  voter_id uuid not null unique references voters(id),
  token_id uuid not null unique references voting_tokens(id),
  device_hash text, ip_hash text, user_agent_hash text,
  created_at timestamptz default now())
  index on (device_hash, ip_hash)

rate_limits(bucket text, key_hash text, window_start timestamptz, count int,
            primary key (bucket, key_hash, window_start))
```

**Functions:** `cast_vote(...)` returns a status code and team id. `rate_limit_hit(...)` returns a boolean. `get_results()` returns team id, name, logo, accent, vote count, percent and rank, for active teams only.

**Access:** RLS is enabled on every table with **no policies**, so the anon key can read nothing. The app talks to Supabase **only from the server** using the service-role key. No Supabase client runs in the browser. `EXECUTE` on the functions is revoked from `anon` and `authenticated`.

**Seed:** 11 placeholder teams ("Team 1"…"Team 11", placeholder logos and accent colours). One `voting_config` row starts **disabled** with placeholder dates. The real event dates are set by the admin in `/admin/settings`, so they don't affect the build.

**Storage:** a public Supabase Storage bucket, `team-logos`. The admin uploads go through a server route using the service role.

## 7. Pages and UI

The app is mobile-first, built with Tailwind. Logos use `next/image`. The ballot page is server-rendered with team data, so the only client JS is selection, Turnstile and submit.

```
┌──────────────────────────┐
│        DOC IPL           │
│ Who is the most popular  │
│ team in Doc IPL?         │
│ Vote for your favourite. │
│ ┌──────────┐┌──────────┐ │   2-column grid of cards
│ │  [logo]  ││  [logo]  │ │   selected = thick accent border + ✓
│ │ Team 1   ││ Team 2   │ │   min 44px touch targets
│ └──────────┘└──────────┘ │
│   ... 11 cards ...       │
│ [ Turnstile ]            │
│ ┌──────────────────────┐ │   sticky bottom button,
│ │    CAST MY VOTE      │ │   disabled until team chosen,
│ └──────────────────────┘ │   spinner while submitting
│ Privacy notice (link)    │
└──────────────────────────┘
```

- `/` shows the status: before the window it shows "Voting opens soon" with the start time in IST. During the window it shows a "Vote now" button to `/v`. After the window it shows "Voting has closed" with [VIEW FINAL RESULTS].
- `/results`: medals 🥇🥈🥉, logo, name, votes, %, rank. Server-rendered, then polls `/api/results` every 15s. The `/api/results` response is cached for 10s at the CDN.
- `/privacy`: a short notice saying hashed technical identifiers (cookie ID, IP, device signal) are processed only to prevent duplicate or fraudulent votes, kept until the event ends plus 30 days, and that no personal details are collected.
- Visual design follows a "frontend-design" pass during Phase 3, using the league's colours once the real logos arrive.

## 8. Admin

- `/admin/login`: a single `ADMIN_PASSWORD` env var. On success the server sets a signed, HttpOnly `dipl_admin` session cookie (HMAC with `ADMIN_SESSION_SECRET`, 12h). Login attempts are rate-limited.
- `/admin` dashboard shows total votes, votes per team, current status, start and end.
- `/admin/teams`: list, add or edit (name, slug, accent, display order, active) and logo upload.
- `/admin/settings`: start and end (entered in IST, stored as UTC), enabled toggle and the device-and-network cap.
- `/admin/results`: a live table and CSV export (`team, votes, percent`, plus an optional export of every vote with team and timestamp only).
- "Open test ballot" is a link to `/v`. Testing repeat votes means clearing cookies or using a private window.

## 9. Hosting

- **Vercel** (user has an account), on the free `*.vercel.app` domain at first, e.g. `docipl-vote.vercel.app`. A custom domain can be attached later with no code change; only `NEXT_PUBLIC_SITE_URL` and the Turnstile hostname list need updating.
- **Supabase:** no project exists yet. One free hosted project will be created and used for both development and production. Test votes are cleared with the admin reset.
- **Cloudflare Turnstile:** the user creates a free widget for the Vercel hostname (plus `localhost`). Until then, Cloudflare's test keys are used.

## 9b. Configuration (env)

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL          (server use only in practice)
SUPABASE_SERVICE_ROLE_KEY         (server only)
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY              (server only)
HASH_SECRET                       (32+ random bytes; HMAC key for all identifiers)
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
RATE_LIMIT_MINT / _VOTE / _STATUS (e.g. "60/600" = max/windowSeconds; optional)
```

In local dev, Turnstile uses Cloudflare's test keys (always-pass and always-fail).

## 10. Folder structure

```
docipl-voter/
  src/
    app/
      page.tsx                    status landing
      v/route.ts                  mint token + redirect
      vote/[token]/page.tsx       ballot (server) + BallotForm (client)
      thanks/page.tsx
      results/page.tsx
      privacy/page.tsx
      admin/login/page.tsx
      admin/(protected)/layout.tsx      session guard
      admin/(protected)/page.tsx        dashboard
      admin/(protected)/teams/...
      admin/(protected)/settings/page.tsx
      admin/(protected)/results/page.tsx
      api/vote/route.ts
      api/vote-status/route.ts
      api/results/route.ts
      api/admin/...               login, logout, teams, logo upload, config, export.csv
    components/                   TeamCard, Leaderboard, StatusScreen, ...
    lib/
      env.ts                      zod-validated env
      supabase.ts                 server-only service-role client
      crypto.ts                   randomToken, sha256, hmac
      cookies.ts                  voter + admin cookie helpers
      ip.ts                       client IP extraction
      rateLimit.ts
      turnstile.ts
      votingWindow.ts             status from config + now
      fingerprint.client.ts       device signal (browser)
  supabase/
    config.toml
    migrations/0001_init.sql, 0002_functions.sql
    seed.sql
  tests/                          vitest unit tests for lib/
  docs/superpowers/specs/
```

## 11. Phases (unchanged order from brief)

1. Setup: Next.js (App Router, TS, Tailwind), env validation, Supabase server client, base layout.
2. Database: migrations (tables, constraints, RLS, functions), seed, generated types.
3. Ballot UI. 4. Vote API. 5. Anti-abuse (cookie, device signal, limits, Turnstile, `/v`). 6. Results. 7. Admin. 8. Hardening and test matrix (from the brief §18).

This session covers **Phases 1–2**.

## 12. Decisions made by the designer (open to override)
- Device check is a **cap of 3 per device and network**, not a hard block, because identical iPhones would otherwise collide (5.4).
- A token is not tied to a voter cookie. Identity at vote time is the cookie present then, so "Open in Safari" still works.
- Rate limiting runs in Postgres, so there's no Redis.
- Admin auth is a single shared password.
- Times are shown in IST (Asia/Kolkata).
- Results are public throughout voting.

- **IP source:** Vercel serves the app directly, with no Cloudflare proxy in front, so the client IP is read from Vercel's `x-forwarded-for` and `x-real-ip` headers. Turnstile is only the widget and needs no proxy.
- **`GET /api/vote-status`** returns `{ state: 'before'|'open'|'closed', start, end, hasVoted, votedTeamName? }` for the caller's own cookie only. The ballot page calls it when it loads from the back/forward cache, to bounce someone who already voted, and the status screens use it to switch state when the window opens or closes. It never reveals another voter's data.
- **Test votes:** admin gets a "Reset all votes & tokens" action. It's allowed only while voting is disabled, and the admin must type `RESET` to confirm. Pre-launch testing: enable the window, test, disable, reset, then set the real window.
- **Retention:** admin gets a "Purge identifiers" action. It deletes `voters`, `voting_tokens` and `rate_limits` and clears the hash columns in `votes`, keeping team and timestamp. It's run by hand after the event, and the privacy notice says identifiers are deleted within 30 days.

## 12a. Test matrix (Phase 8, from the brief)
Duplicate voting · expired token · reused token · voting before start · voting after end · invalid team · invalid Turnstile · rate limiting · refresh after voting · multiple browsers · mobile Safari · Chrome Android · Instagram in-app browser (iOS and Android) and "Open in Safari" · slow network · simultaneous votes on the same token.

## 12b. Implementation notes
As built: the admin route is `/admin/voting` (not `/admin/settings`), logout is a Server Action (not an API route), and `Referrer-Policy` is `same-origin`.

## 13. Left to the builder
Pace: no fixed deadline was given, so build phase by phase. Exact Tailwind styling, the component breakdown, how the fingerprint is calculated, test tooling details, and the CSV format details.
