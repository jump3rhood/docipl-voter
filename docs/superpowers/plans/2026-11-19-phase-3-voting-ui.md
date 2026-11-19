# Doc IPL Voting — Phase 3 (Voting UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real team data, the Doc IPL brand theme, and the mobile screens: status landing, ballot, thank-you and privacy. The ballot posts to `/api/vote`, which Phase 4 builds.

**Architecture:** Server components read from Supabase through small `src/lib/voting.ts` functions. Interactive parts are client components that receive their side effects as props, so they can be tested with Testing Library without Next mocks. Pure logic (state derivation, date formatting, error copy) lives in plain modules with unit tests.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents: true`), React 19, Tailwind 4, Vitest + @testing-library/react + jsdom (new dev deps).

**Spec:** `docs/superpowers/specs/2026-11-19-docipl-voting-design.md` (§4 flow and error copy, §7 pages). Also read `docs/superpowers/notes/phase-3-plus-carry-forward.md`.

## Global Constraints

- **Mobile-only design.** Single column, `max-w-md` centred; no `sm:`/`md:`/`lg:` layout breakpoints. On desktop the same column sits centred on the navy background.
- Brand tokens (Tailwind `@theme`): `navy #0B2A5B`, `navy-light #12376F` (cards), `navy-dark #071C3D`, `brand-yellow #FFD21F`, text white. `themeColor` `#0B2A5B`. Font: Geist sans (remove the Arial override).
- Touch targets at least 44px. The primary button is yellow with navy text, sticky to the bottom of the ballot, `font-extrabold`, uppercase.
- Placeholder logo: `public/brand/docipl-logo-placeholder.png` (172×182). Show it via `next/image` at 96px.
- Times are shown in IST (`Asia/Kolkata`).
- No Supabase in client components; data comes from server components via `src/lib/voting.ts`.
- Copy (verbatim):
  - Heading: `Who is the most popular team in Doc IPL?`
  - Subheading: `Vote for your favourite team.`
  - Button: `CAST MY VOTE`
  - Thank-you: `🎉 THANK YOU!`, `Your vote has been recorded.`, `You voted for:`, `VIEW LIVE RESULTS`
  - Status titles: `DOC IPL PEOPLE'S CHOICE`; before → `Voting opens soon.` + `Voting starts:` + time; paused → `Voting is paused.` + `Check back soon.`; open → `Voting is open!` + button `VOTE NOW` (→ `/v`); closed → `Voting has closed.` + `Thank you to everyone who participated!` + button `VIEW FINAL RESULTS` (→ `/results`).
- Commit after each task. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Double-tap on CAST MY VOTE** must send exactly one request. The button is disabled while submitting. Test: `submits once on double click` (Task 5).
2. **A failed submit** shows the error message and lets the user retry without losing their selection. Test: `shows error and keeps selection` (Task 5).
3. **A team with no logo** still shows a recognisable card: an accent-coloured circle with initials. Test: `renders initials when no logo` (Task 5).
4. **The window boundary in the UI:** `now == end` is closed, and disabled with `start <= now` is paused. Tests: `deriveVotingState` cases (Task 3).
5. **A network failure** (fetch rejects or the response isn't JSON) maps to a generic retry message, not a crash. Test: `network failure → generic error` (Task 6).

---

### Task 1: Real team names in seed

**Files:**
- Modify: `supabase/seed.sql`, `tests/db/schema.test.ts`, `tests/db/functions.test.ts`

**Interfaces:**
- Produces: seeded teams (name, slug, accent_color, display_order):
  - Smash Squad 2.0, `smash-squad`, `#F97316`, 1
  - Jager Shots, `jager-shots`, `#22C55E`, 2
  - Code Red, `code-red`, `#EF4444`, 3
  - The Rush, `the-rush`, `#A855F7`, 4
  - Dink N Drive, `dink-n-drive`, `#14B8A6`, 5
  - Spin Mavericks, `spin-mavericks`, `#EC4899`, 6
  - Code Blue, `code-blue`, `#3B82F6`, 7
  - White Coat Warriors, `white-coat-warriors`, `#E5E7EB`, 8
  - The Pacemakers, `the-pacemakers`, `#84CC16`, 9
  - VDC Spartans, `vdc-spartans`, `#B45309`, 10
  - Dinking Dragons, `dinking-dragons`, `#6366F1`, 11

  (`display_order` is the league's team number: T1…T11.)

- [ ] **Step 1:** Update the schema test's slug list to the 11 slugs above, in order. Replace every `team-N` / `Team N` in the functions tests with a real slug or name (e.g. `team-3`/`Team 3` → `code-red`/`Code Red`).
- [ ] **Step 2:** Run `npm run test:db` → the schema test FAILS (old seed).
- [ ] **Step 3:** Update `seed.sql`.
- [ ] **Step 4:** Run `npm run db:reset && npm run test:db` → all PASS.
- [ ] **Step 5:** Commit — `feat(db): seed real Doc IPL team names`

---

### Task 2: Brand theme and app shell

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/Heartbeat.tsx`, `src/components/BrandHeader.tsx`

**Interfaces:**
- Produces:
  - Tailwind colour utilities `bg-navy`, `bg-navy-light`, `bg-navy-dark`, `text-brand-yellow`, `bg-brand-yellow`, `border-brand-yellow`.
  - `<Heartbeat className?: string />`: an inline SVG ECG line (flat → spike → flat) using `currentColor`, about 24px tall, full width, `aria-hidden`.
  - `<BrandHeader />`: the centred logo image (alt `Doc IPL – Doctors Indian Pickleball League`) with a white `Heartbeat` below it.
- Layout: body `bg-navy text-white`, `min-h-dvh`, the centred `max-w-md` column, `<BrandHeader />` at the top (replaces the "DOC IPL" text header), and `<main>`. `themeColor` is `#0B2A5B`. The dark-mode media query and the Arial override are removed.

- [ ] **Step 1:** Implement the theme, the components and the layout.
- [ ] **Step 2:** Verify `npm run build` and `npm run lint` pass. With `npm run dev`, `/` renders a navy page with the logo and heartbeat, and the placeholder home text in white.
- [ ] **Step 3:** Commit — `feat(ui): Doc IPL brand theme and header`

---

### Task 3: Voting data and copy library

**Files:**
- Create: `src/lib/voting.ts`, `src/lib/votingState.ts`, `src/lib/formatIST.ts`, `src/lib/voteMessages.ts`
- Test: `tests/votingState.test.ts`, `tests/formatIST.test.ts`, `tests/voteMessages.test.ts`, `tests/db/voting.test.ts`

**Interfaces:**
- `votingState.ts` (pure, client-safe):
  - `type VotingState = 'before' | 'open' | 'paused' | 'closed'`
  - `deriveVotingState(cfg: { start: Date; end: Date; enabled: boolean }, now: Date): VotingState`. Returns `closed` if `now >= end`, else `open` if enabled and `now >= start`, else `paused` if not enabled and `now >= start`, else `before`.
- `formatIST.ts` (pure): `formatIST(d: Date): string` → e.g. `Saturday, 21 Nov, 9:00 AM`. Use `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', … }).formatToParts` and assemble `${weekday}, ${day} ${month}, ${hour}:${minute} ${AM|PM}` with a 12-hour clock, no leading zero on the hour, and uppercase AM/PM.
- `voteMessages.ts` (pure):
  - `type VoteErrorCode = 'already_voted' | 'voting_not_open' | 'voting_closed' | 'token_invalid' | 'invalid_team' | 'turnstile_failed' | 'rate_limited' | 'network'`
  - `voteErrorMessage(code: VoteErrorCode): { title: string; body?: string }`, with this copy:
    - `already_voted` → `You've already voted!` / `Each person can vote only once.`
    - `voting_not_open` → `Voting hasn't started yet.`
    - `voting_closed` → `Voting has closed.`
    - `token_invalid` → `This ballot link has expired.` / `Get a new ballot to vote.`
    - `invalid_team` → `That team isn't available.` / `Please pick another team.`
    - `turnstile_failed` → `Please try again.`
    - `rate_limited` → `Too many attempts.` / `Please wait a minute and try again.`
    - `network` → `Something went wrong.` / `Check your connection and try again.`
- `voting.ts` (server, `import 'server-only'`):
  - `type Team = { id: string; name: string; slug: string; logoUrl: string | null; accentColor: string | null }`
  - `getActiveTeams(): Promise<Team[]>`: active teams ordered by `display_order`. Throws on a DB error.
  - `getVotingStatus(now?: Date): Promise<{ state: VotingState; start: Date; end: Date }>`: reads the `voting_config` row and uses `deriveVotingState`.

- [ ] **Step 1: Write failing tests**

```ts
// votingState
const s = new Date('2026-11-21T03:30:00Z'), e = new Date('2026-11-22T15:30:00Z');
test.each([
  [true,  '2026-11-21T03:29:59Z', 'before'],
  [true,  '2026-11-21T03:30:00Z', 'open'],
  [false, '2026-11-21T10:00:00Z', 'paused'],
  [false, '2026-11-20T10:00:00Z', 'before'],
  [true,  '2026-11-22T15:30:00Z', 'closed'],
  [false, '2026-11-23T00:00:00Z', 'closed'],
])('enabled=%s at %s → %s', (enabled, now, want) =>
  expect(deriveVotingState({ start: s, end: e, enabled }, new Date(now))).toBe(want));
// formatIST
expect(formatIST(new Date('2026-11-21T03:30:00Z'))).toBe('Saturday, 21 Nov, 9:00 AM');
expect(formatIST(new Date('2026-11-22T15:30:00Z'))).toBe('Sunday, 22 Nov, 9:00 PM');
expect(formatIST(new Date('2026-11-21T18:45:00Z'))).toBe('Sunday, 22 Nov, 12:15 AM');
// voteMessages
expect(voteErrorMessage('already_voted')).toEqual({ title: "You've already voted!", body: 'Each person can vote only once.' });
expect(voteErrorMessage('network').title).toBe('Something went wrong.');
// tests/db/voting.test.ts (DB suite; beforeEach resetData)
test('getActiveTeams returns 11 in display order, excludes inactive', ...) // first 'Smash Squad 2.0', last 'Dinking Dragons'; after deactivating code-red → 10 rows without it
test('getVotingStatus reads config', ...) // seed config, now = 2026-11-20 → 'before', start equals seed start
```
The DB test imports `@/lib/voting`. Add the `server-only` stub alias and the `@` alias to `vitest.db.config.mts` if they're missing. `getSupabaseAdmin` reads `getServerEnv()`, so the DB test config must supply the full set of env vars. Add dummy values for the non-Supabase vars in `vitest.db.config.mts` via `test.env`.

- [ ] **Step 2:** Run `npm test` and `npm run test:db` → FAIL.
- [ ] **Step 3:** Implement the four modules.
- [ ] **Step 4:** Run `npm test` and `npm run test:db` → PASS.
- [ ] **Step 5:** Commit — `feat: voting state, IST formatting, vote copy and data access`

---

### Task 4: Status landing page and privacy page

**Files:**
- Create: `src/components/StatusScreen.tsx`, `src/app/privacy/page.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/StatusScreen.test.tsx`

**Interfaces:**
- Consumes: `getVotingStatus`, `formatIST`, `VotingState`.
- Produces: `<StatusScreen state: VotingState; startLabel: string />`, a presentational component using the status copy in Global Constraints. Buttons are `next/link`s styled as the yellow primary button.
- `/` (server): `getVotingStatus()` → `<StatusScreen state startLabel={formatIST(start)} />`. To satisfy `cacheComponents`, put the dynamic read in an async child inside `<Suspense>` with a small navy skeleton fallback, and call `await connection()` before reading.
- `/privacy`: static. Heading `Privacy`. It says:
  - Doc IPL collects no name, email, phone number or location.
  - To prevent duplicate or automated votes, technical identifiers (a browser cookie ID, IP address and a device signal) are processed. They're stored only in scrambled (hashed) form, and are deleted within 30 days after voting closes.
  - Cloudflare Turnstile is used for bot protection.
  - A link back to `/`.

- [ ] **Step 1:** Install `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` and `jsdom` as dev dependencies. Component tests use `// @vitest-environment jsdom`. Add `tests/**/*.test.tsx` to the unit config include, and a setup file that imports `@testing-library/jest-dom/vitest`.
- [ ] **Step 2: Failing tests**

```tsx
test('before shows start time', () => {
  render(<StatusScreen state="before" startLabel="Saturday, 21 Nov, 9:00 AM" />);
  expect(screen.getByText('Voting opens soon.')).toBeInTheDocument();
  expect(screen.getByText('Saturday, 21 Nov, 9:00 AM')).toBeInTheDocument();
});
test('open links to /v', () => {
  render(<StatusScreen state="open" startLabel="x" />);
  expect(screen.getByRole('link', { name: 'VOTE NOW' })).toHaveAttribute('href', '/v');
});
test('closed links to results', ...)   // 'Voting has closed.' + link 'VIEW FINAL RESULTS' → /results
test('paused copy', ...)                // 'Voting is paused.' and no links
```
- [ ] **Step 3:** Implement. **Step 4:** Run `npm test`, `npm run build` and `npm run lint` → pass.
- [ ] **Step 5:** Commit — `feat(ui): status landing and privacy pages`

---

### Task 5: Team card and ballot form

**Files:**
- Create: `src/components/TeamCard.tsx`, `src/components/BallotForm.tsx`
- Test: `tests/BallotForm.test.tsx`

**Interfaces:**
- Consumes: `Team` (type only, imported with `import type` from `@/lib/voting`), `voteErrorMessage`, `VoteErrorCode`.
- Produces:
  - `type SubmitResult = { ok: true; teamName: string } | { ok: false; code: VoteErrorCode }` (exported from `BallotForm.tsx`).
  - `<TeamCard team: Team; selected: boolean; onSelect: () => void />`: a `role="radio"` button with `aria-checked`. It shows the logo (`next/image`, 64px), or initials in an accent-coloured circle when `logoUrl` is null. Initials are the first letters of the first two words, ignoring words that start with a digit: "Smash Squad 2.0" gives SS, "Dink N Drive" gives DN. The team name sits below. When selected it has a yellow 3px border and a ✓ badge. The card is at least 120px tall.
  - `<BallotForm teams: Team[]; submit: (teamId: string) => Promise<SubmitResult>; onVoted: (teamName: string) => void />` (`'use client'`):
    - The cards sit in a `role="radiogroup"` 2-column grid.
    - Heading and subheading use the verbatim copy.
    - The sticky `CAST MY VOTE` button is disabled until a team is chosen and while submitting; it shows a spinner and `Submitting…` while in flight.
    - On `ok` it calls `onVoted`. On an error it shows `voteErrorMessage(code)` in a `role="alert"` box above the button and keeps the selection.
    - For `token_invalid` the alert also shows a link `Get a new ballot` → `/v`.

- [ ] **Step 1: Failing tests** (`teams` = 3 fixture teams, one with a null `logoUrl`)

```tsx
test('button disabled until a team is selected', ...)
test('selecting a card marks it checked and only one', ...)       // click A then B → B aria-checked=true, A false
test('renders initials when no logo', ...)                         // fixture 'Dink N Drive' → 'DN'
test('submits selected team and calls onVoted', ...)               // submit resolves ok → onVoted('Code Red'), submit called with code-red id
test('submits once on double click', async () => {
  const submit = vi.fn(() => new Promise<SubmitResult>(r => setTimeout(() => r({ ok: true, teamName: 'X' }), 50)));
  // select, dblClick button → expect(submit).toHaveBeenCalledTimes(1)
});
test('shows error and keeps selection', ...)                       // submit → {ok:false, code:'already_voted'} → alert has "You've already voted!", card still checked, button enabled
test('token_invalid shows new ballot link', ...)                   // link 'Get a new ballot' href '/v'
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test` and `npm run lint` → PASS.
- [ ] **Step 5:** Commit — `feat(ui): team cards and ballot form`

---

### Task 6: Ballot route, submit wiring and thank-you page

**Files:**
- Create: `src/app/vote/[token]/page.tsx`, `src/app/vote/[token]/BallotClient.tsx`, `src/lib/submitVote.ts`, `src/components/ThankYou.tsx`, `src/app/thanks/page.tsx`
- Test: `tests/submitVote.test.ts`, `tests/ThankYou.test.tsx`

**Interfaces:**
- `submitVote.ts` (client-safe): `postVote(input: { token: string; teamId: string; turnstileToken: string; deviceSignal: string | null }, fetchImpl?: typeof fetch): Promise<SubmitResult>`.
  - It makes `POST /api/vote` with a JSON body `{ token, teamId, turnstileToken, deviceSignal }`.
  - It returns the parsed `{ ok: true, teamName }`, or `{ ok: false, code }` when `code` is a known `VoteErrorCode`. Anything else (a rejection, non-JSON, or an unknown shape or code) returns `{ ok: false, code: 'network' }`.
- `/vote/[token]` (server): checks the voting status. If the state isn't `open`, it renders `<StatusScreen>`. Otherwise it renders `<BallotClient token teams />`. The dynamic read goes in an async child inside `<Suspense>` with `await connection()`. Token validity is checked in Phase 5.
- `BallotClient` (`'use client'`) wires `<BallotForm>`. For now `submit` calls `postVote` with `turnstileToken: ''` and `deviceSignal: null` (Phase 5 fills these in). `onVoted` calls `router.replace('/thanks')`.
- `<ThankYou teamName: string | null />` shows the verbatim thank-you copy. When `teamName` is null it omits the "You voted for" block. The `VIEW LIVE RESULTS` link goes to `/results`.
- `/thanks` renders `<ThankYou teamName={null} />`. Phase 5 will read the voter cookie to show the team.

- [ ] **Step 1: Failing tests**

```ts
test('ok response → ok result', ...)            // fetchImpl returns Response.json({ok:true, teamName:'Code Red'}) → {ok:true, teamName:'Code Red'}; body has token/teamId
test('known error code passes through', ...)    // {ok:false, code:'token_invalid'} → same
test('unknown code → network', ...)             // {ok:false, code:'weird'} → {ok:false, code:'network'}
test('network failure → generic error', ...)    // fetchImpl rejects → {ok:false, code:'network'}; non-JSON 500 body → network
test('ThankYou shows team', ...)                // 'You voted for:' and 'Code Red'; link 'VIEW LIVE RESULTS' → /results
test('ThankYou without team', ...)              // no 'You voted for:'
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, `npm run test:db`, `npm run lint` and `npm run build` → all pass. Manual check: with `npm run dev`, enable voting in the local DB (`update voting_config set is_enabled=true, voting_start=now()-interval '1 hour', voting_end=now()+interval '1 day'`). `/vote/anything` then shows 11 cards, and selection works; submitting shows `Something went wrong.` because `/api/vote` doesn't exist until Phase 4.
- [ ] **Step 5:** Commit — `feat(ui): ballot route, vote submit client and thank-you page`
