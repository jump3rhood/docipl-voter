# Doc IPL Voting — Phase 6 (Live Results) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, mobile-only `/results` leaderboard. It shows all active teams sorted by votes, with rank, medals, logo or initials, vote count and percentage, and refreshes live every 15 seconds. Phase 6 also fixes the Turnstile watchdog so it can't interrupt a visible challenge.

**Architecture:**
- The `/results` server page renders the first snapshot from `get_results()`, so it is fast and works without JS.
- A client `Leaderboard` then polls `GET /api/results`. The response is CDN-cached for 10s, so traffic spikes hit the DB at most a few times a minute.
- Only aggregates leave the server.
- The team logo/initials badge is extracted from `TeamCard` so the ballot and the leaderboard share it.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), Supabase RPC `get_results`, React 19, Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md` §7 (`/results`) and the brief's §9 (leaderboard). Carry-forward: `docs/superpowers/notes/phase-3-plus-carry-forward.md`:
- medals only when votes > 0
- `get_results` `logo_url`/`accent_color` are nullable
- Turnstile watchdog vs. visible challenge

## Global Constraints

- Mobile-only design, using the existing brand tokens (`bg-navy`, `bg-navy-light`, `text-brand-yellow`, …). Layout already provides the header.
- Copy (verbatim):
  - page heading `Doc IPL People's Choice`
  - subheading while open `Live results · updates every 15 seconds`
  - subheading when closed `Final results`
  - subheading otherwise `Results`
  - total line `{N} votes cast` (`1 vote cast` when N = 1)
  - empty state `No votes yet.`
  - links `VOTE NOW` (plain `<a href="/v">`, only while open) and `Privacy`
- Medals: 🥇 / 🥈 / 🥉 for rank 1 / 2 / 3, **only when that row's votes > 0**. Otherwise show the numeric rank. Tied teams share a rank (from SQL).
- Vote counts are formatted with `en-IN` grouping (`1,284`; `1,00,000`). Percent shows one decimal (`37.5%`).
- `/api/results` returns only aggregates: `{ total: number, rows: ResultRow[] }`. Headers:
  - `Cache-Control: public, s-maxage=10, stale-while-revalidate=20`
  - on error, 500 `{ error: 'unavailable' }` with `Cache-Control: no-store`
- Polling: every 15s, paused while `document.visibilityState === 'hidden'`, with an immediate refresh when the page becomes visible again. A failed poll keeps the last good data and shows nothing alarming.
- Commit after each task. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Zero votes:** no medals anywhere, every row shows `0` and `0.0%`, and the empty-state line is shown. Test: `zero votes: no medals` (Task 3).
2. **Ties:** two teams on 3 votes both show 🥇, and the next team is rank 3 → 🥉. Test: `ties share medal` (Task 1, `medalFor`).
3. **A failed poll** keeps the previous rows, and the page doesn't break. Test: `poll failure keeps data` (Task 3).
4. **Inactive teams** never appear on the leaderboard. Covered by the existing `get_results` SQL test plus `getResults excludes inactive` (Task 1).
5. **The Turnstile watchdog** must not fire while an interactive challenge is visible. Test: `watchdog paused during interactive challenge` (Task 4).

---

### Task 1: Results data and formatting

**Files:**
- Create: `src/lib/results.ts` (server-only), `src/lib/resultsFormat.ts` (pure)
- Test: `tests/db/results.test.ts`, `tests/resultsFormat.test.ts`

**Interfaces:**
- `resultsFormat.ts`:
  - `type ResultRow = { teamId: string; name: string; slug: string; logoUrl: string | null; accentColor: string | null; votes: number; percent: number; rank: number }`
  - `type ResultsPayload = { total: number; rows: ResultRow[] }`
  - `medalFor(row: Pick<ResultRow, 'rank' | 'votes'>): '🥇' | '🥈' | '🥉' | null`
  - `formatVotes(n: number): string` (en-IN)
  - `formatPercent(p: number): string` (`'37.5%'`, `'0.0%'`, `'100.0%'`)
  - `totalLabel(n: number): string` (`'1 vote cast'`, `'1,284 votes cast'`)
- `results.ts`: `getResults(): Promise<ResultsPayload>`. It calls `get_results`, coerces `votes`, `percent` and `rank` with `Number()`, narrows nullable logo/accent to `null`, and computes `total` as the sum of votes. It throws on an RPC error.

- [ ] **Step 1: Failing tests**

```ts
// resultsFormat
expect(medalFor({ rank: 1, votes: 5 })).toBe('🥇');
expect(medalFor({ rank: 3, votes: 1 })).toBe('🥉');
expect(medalFor({ rank: 1, votes: 0 })).toBeNull();
expect(medalFor({ rank: 4, votes: 9 })).toBeNull();
test('ties share medal', ...) // rows rank [1,1,3] votes [3,3,1] → ['🥇','🥇','🥉']
expect(formatVotes(1284)).toBe('1,284'); expect(formatVotes(100000)).toBe('1,00,000');
expect(formatPercent(37.5)).toBe('37.5%'); expect(formatPercent(0)).toBe('0.0%');
expect(totalLabel(1)).toBe('1 vote cast'); expect(totalLabel(1284)).toBe('1,284 votes cast');
// tests/db/results.test.ts (beforeEach resetData; cast votes via existing helpers/RPCs)
test('getResults totals and order', ...)        // 3 votes code-red, 1 jager-shots → total 4; rows[0] code-red votes 3 percent 75 rank 1; 11 rows; votes are numbers
test('getResults excludes inactive', ...)       // deactivate the-rush → 10 rows, none slug the-rush
test('getResults zero state', ...)              // total 0, all percent 0, all rank 1
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test` and `npm run test:db` → PASS.
- [ ] **Step 5:** Commit — `feat: results data access and formatting`

---

### Task 2: `GET /api/results`

**Files:**
- Create: `src/app/api/results/route.ts`
- Test: `tests/db/route-results.test.ts`

**Interfaces:**
- `GET(): Promise<NextResponse>`: calls `getResults()` and returns 200 with the payload and the cache header. On error it logs `console.error('[results] unavailable', message)` and returns 500 `{ error: 'unavailable' }` with `no-store`. The payload keys are exactly `total` and `rows`. Each row's keys are exactly those of `ResultRow`, so no voter data is exposed.

- [ ] **Step 1: Failing tests:**
  - `200 with payload and cache header`: assert the header string exactly.
  - `rows expose only ResultRow keys`: `Object.keys(row).sort()` equals the expected list.
  - `500 on failure`: `vi.mock('@/lib/results')` throwing → 500, `no-store`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Check `npm run build` lists the route without errors under `cacheComponents`. If the build tries to prerender it, call `await connection()` first.
- [ ] **Step 4:** Run `npm run test:db`, `npm run lint` and `npm run build` → pass. **Step 5:** Commit — `feat: aggregated results API`

---

### Task 3: Leaderboard UI and `/results` page

**Files:**
- Create: `src/components/TeamBadge.tsx`, `src/components/Leaderboard.tsx`, `src/app/results/page.tsx`
- Modify: `src/components/TeamCard.tsx` (use `TeamBadge`; keep `teamInitials` exported from wherever tests import it)
- Test: `tests/Leaderboard.test.tsx`

**Interfaces:**
- `<TeamBadge name: string; logoUrl: string | null; accentColor: string | null; size: number />`: a logo (`next/image`, `unoptimized`) or initials circle with `pickTextColor` contrast. It is the same visual as the current TeamCard badge, now shared.
- `<Leaderboard initial: ResultsPayload; state: VotingState; pollMs?: number (default 15000); fetchImpl?: typeof fetch />` (`'use client'`):
  - Shows the heading, the subheading by `state`, `totalLabel(total)`, then an ordered list (`<ol>`) of rows.
  - Each row: medal or `#rank` (fixed-width slot), `TeamBadge` at 40px, team name, `formatVotes` count and `formatPercent`, plus a thin percent bar (yellow fill, width = percent%).
  - Rank 1 rows with votes > 0 get a yellow-tinted highlight.
  - `No votes yet.` when `total === 0`.
  - `VOTE NOW` plain anchor to `/v` only when `state === 'open'`, plus the Privacy link.
  - Polls `/api/results` per Global Constraints. On a valid payload it replaces the rows; on failure it keeps the old ones.
- `/results` page (server):
  - `metadata.title` is `Results — Doc IPL People's Choice`.
  - An async child under `<Suspense>` calls `await connection()`, then `getResults()` and `getVotingStatus()`, and renders `<Leaderboard initial state />`.
  - If `getResults` throws, it lets `error.tsx` handle it.

- [ ] **Step 1: Failing tests** (jsdom; fake timers for polling)

```tsx
test('renders rows in order with medals, votes and percent', ...)  // payload: code-red 3 (75%) rank1, jager 1 (25%) rank2, rest 0 rank3 → first row has 🥇 'Code Red' '3' '75.0%'; second 🥈; zero-vote rank-3 rows show '#3' not 🥉
test('zero votes: no medals', ...)                                  // all votes 0 → no 🥇🥈🥉 in document; 'No votes yet.' shown; '0 votes cast'
test('subheading by state', ...)                                    // open → 'Live results · updates every 15 seconds' and VOTE NOW link href /v (tagName A); closed → 'Final results', no VOTE NOW
test('polls and updates', ...)                                      // fetchImpl returns new payload; advance 15000ms → new total shown
test('poll failure keeps data', ...)                                // fetchImpl rejects → original rows still shown, no error text
test('no polling while hidden', ...)                                // visibilityState 'hidden' → advance 30000ms → fetchImpl not called
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Refactor `TeamCard` to use `TeamBadge` with no visual change; the existing BallotForm tests must stay green.
- [ ] **Step 4:** Run `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `feat(ui): live results leaderboard`

---

### Task 4: Turnstile watchdog must not interrupt a visible challenge

**Files:**
- Modify: `src/components/TurnstileWidget.tsx`
- Create (if helpful): `src/lib/watchdog.ts` (a pure timer helper with `start`, `stop` and `restart`)
- Test: `tests/watchdog.test.ts` (or `tests/TurnstileWidget.test.tsx` with a fake `window.turnstile`)

**Behaviour:**
- Pass `'before-interactive-callback'` (stop the watchdog: the user is looking at a challenge) and `'after-interactive-callback'` (restart it) in the render options.
- The watchdog still fires for a dead script, a render failure, or no token without any interactive phase.

- [ ] **Step 1: Failing tests**, using a fake `window.turnstile` that captures the render options and fake timers:
  - `watchdog paused during interactive challenge`: call `before-interactive-callback`, advance 20s, and assert `onError` was not called.
  - `watchdog restarts after interaction`: call `after-interactive-callback`, advance 12s+, and assert `onError('timeout')` was called.
  - `timeout without interaction`: advance 12s+ → `onError('timeout')`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run lint` and `npm run build` → pass.
- [ ] **Step 5:** Commit — `fix: pause Turnstile watchdog during interactive challenges`

---

## After all tasks: controller Playwright pass (390×844)

1. `/results` with zero votes → no medals, `No votes yet.`
2. Cast 3 votes via `/v` (fresh cookies) for two teams → `/results` shows the leader with 🥇, correct counts and percentages, sorted.
3. Cast another vote in a second tab and wait about 15s, or reload → the count updates.
4. The thank-you page's VIEW LIVE RESULTS → `/results`.
5. Close voting (end in the past) → subheading `Final results`, no VOTE NOW.
6. Screenshot the page for the user.
