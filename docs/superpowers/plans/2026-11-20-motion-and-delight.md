# Doc IPL Voting — Motion & Delight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page motion, an interactive floating-pickleball background, a confirm-before-vote panel, and a confetti celebration to the public pages, without slowing down the ballot.

**Architecture:**
- Pure, testable logic lives in `src/lib/`: ball physics, tap targeting, and the celebrate-once flag.
- Thin client components draw and animate. The ball field is one canvas mounted in the root layout and hidden on `/admin`.
- Motion is provided once via `LazyMotion` + `MotionConfig reducedMotion="user"`.
- Confetti is dynamically imported on the thank-you page only.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, plus new deps `motion` (import from `motion/react`) and `canvas-confetti` (with `@types/canvas-confetti` as a dev dep).

**Spec:** `docs/superpowers/specs/2026-11-20-motion-and-delight-design.md`

## Global Constraints

- Public pages only. Admin pages get no balls and no new motion.
- No change to vote logic, anti-abuse, the API or DB schema, and no new migration.
- Mobile-only, with 390×844 as the reference viewport. Brand: navy `#0B2A5B`, yellow `#FFD21F`.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Anything animated is a `'use client'` component.
- Use `m.*` components inside `LazyMotion features={domAnimation}`, never `motion.*`, so the full bundle isn't pulled in.
- Respect `prefers-reduced-motion`:
  - `MotionConfig reducedMotion="user"`
  - the balls are drawn once with no loop
  - no confetti
- The ball canvas is `pointer-events: none`. Tap handling never calls `preventDefault`, and taps on interactive elements never move a ball.
- Exact copy:
  - `Vote for {Team}?`
  - `You can only vote once, and it can't be changed.`
  - `YES, CAST MY VOTE`
  - `Change my pick`
- The ballot page may grow by at most about 45 KB of JS (gzipped). Confetti must not load on the ballot.
- Commit each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Everything stays green: `npm test`, `npm run test:db`, `npm run lint`, `npm run build`.

## Review Focus

1. **A tap on a team card or a button must never be swallowed by the ball layer.** Test: `isInteractiveTarget` covers button, a, input, `[role=radio]`, `[role=dialog]` and their descendants (Task 1). The controller also checks this in a real browser.
2. **A double-tap on YES must not submit twice.** Test: `confirm double-tap submits once` (Task 3).
3. **Refreshing the thank-you page must not replay confetti.** Test: `consumeCelebrate returns true once` (Task 4).
4. **Pressing Escape or tapping the backdrop while submitting must not close the sheet or orphan the request.** Test: `sheet cannot be dismissed while submitting` (Task 3).
5. **jsdom and old browsers without canvas must not crash.** Test: `PickleballField renders nothing without 2d context` (Task 1).

---

### Task 1: Dependencies, Motion provider, floating pickleballs

**Files:**
- Modify: `package.json` (add `motion`, `canvas-confetti`, dev `@types/canvas-confetti`)
- Create: `src/lib/pickleballs.ts`, `src/components/MotionProvider.tsx`, `src/components/PickleballField.tsx`
- Modify: `src/app/layout.tsx`
- Tests: `tests/pickleballs.test.ts`, `tests/PickleballField.test.tsx`

**Interfaces (produced):**
- `src/lib/pickleballs.ts`:
  - `type Ball = { x: number; y: number; vx: number; vy: number; r: number; angle: number; spin: number; alpha: number }`
  - `createBalls(count: number, width: number, height: number, rand?: () => number): Ball[]`: radius 14–28 (that's 28–56 px across), alpha 0.35–0.6, gentle drift speed of 8–20 px/s in a random direction.
  - `stepBalls(balls: Ball[], dtSeconds: number, width: number, height: number): void`:
    - moves each ball and applies spin
    - decays any speed above drift back toward drift speed (exponential decay with time constant ≈ 0.6 s), while keeping a minimum drift
    - balls bounce off the edges so they stay fully inside `[r, width-r] × [r, height-r]`
    - spin decays the same way, toward a small base spin
  - `flickAt(balls: Ball[], x: number, y: number): boolean`:
    - the nearest ball whose centre is within 120 px gets an impulse of 600 px/s directed away from (x, y), plus spin of ±6 rad/s; any other ball within 80 px of that ball's centre gets 250 px/s directed away from it
    - returns `true` if a ball was flicked
    - if the tap lands exactly on a centre, push the ball upward
  - `ballCountFor(hardwareConcurrency: number | undefined): number`: 5 if `<= 4`, else 8.
  - `isInteractiveTarget(el: Element | null): boolean`: `true` if `el` or an ancestor matches `button, a, input, select, textarea, label, [role=radio], [role=dialog], [role=button]`.
- `MotionProvider` (client): `<LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user">{children}</MotionConfig></LazyMotion>`
- `PickleballField` (client):
  - **Not shown:** returns `null` when `usePathname()` starts with `/admin`. Also draws nothing (no errors) when `canvas.getContext('2d')` is null.
  - **Canvas:** `<canvas aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">`, with DPR capped at 2. It resizes on `resize`.
  - **Sprite:** drawn once to an offscreen canvas: a yellow ball (`#FFD21F`) with a slightly darker rim and 6–8 holes.
  - **Start:** the rAF loop starts via `requestIdleCallback` (falling back to `setTimeout(…, 200)`) and pauses on `document.hidden`.
  - **Taps:** a `pointerdown` listener on `window`, passive. If the target isn't interactive, it calls `flickAt`.
  - **Reduced motion:** draws a single frame with no loop and no listener.
  - **Cleanup:** everything is removed on unmount.
- `layout.tsx`:
  - wrap the body content in `MotionProvider`
  - render `<PickleballField />` as the first child of `<body>`
  - make sure the body background stays navy behind the canvas by giving `html` the navy background, so the `-z-10` canvas shows above it and below content

- [ ] **Step 1:** `npm i motion canvas-confetti && npm i -D @types/canvas-confetti`
- [ ] **Step 2: Failing tests in `tests/pickleballs.test.ts`:**
  - `createBalls respects count, radius and alpha ranges` (seeded `rand`)
  - `stepBalls keeps balls inside bounds` (after 500 steps of 1/60 s on 390×844, every ball satisfies `r <= x <= w-r` and the same for y)
  - `flick moves nearest ball away and decays back to drift` (a ball at (100,100), tap at (90,100): `flickAt` returns true and `vx > 500`; after 3 s of steps its speed is ≤ 25)
  - `flick ignores taps farther than 120px` (returns false and velocities are unchanged)
  - `flick nudges neighbours within 80px`
  - `ballCountFor` (2→5, 4→5, 8→8, undefined→8)
  - `isInteractiveTarget` (true for button, a span inside a button, `div[role=radio]`, an element inside `[role=dialog]`; false for `main`, `p`, `body`, null)
- [ ] **Step 3: Failing tests in `tests/PickleballField.test.tsx`:**
  - `PickleballField renders nothing without 2d context` (jsdom: renders without throwing; a canvas with `aria-hidden` exists or null)
  - `PickleballField hidden on admin` (mock `next/navigation` `usePathname` → `/admin/voting`; no canvas)
- [ ] **Step 4:** Implement. **Step 5:** All suites green, lint and build clean.
- [ ] **Step 6:** Commit: `feat(ui): motion provider and interactive floating pickleballs`

---

### Task 2: Page motion

**Files:**
- Create: `src/components/motion/Reveal.tsx`
- Modify: `src/components/StatusScreen.tsx`, `BallotForm.tsx` (entrance and stagger only; Task 3 owns the confirm flow), `TeamCard.tsx`, `ThankYou.tsx` (entrance only; Task 4 owns confetti), `Leaderboard.tsx`, `ExpiredBallot.tsx`, `src/app/privacy/page.tsx`, `src/app/slow-down/page.tsx`, `PrimaryLink.tsx`
- Tests: existing component tests stay green; add `tests/Reveal.test.tsx`.

**Interfaces (produced):**
- `Reveal` (client): `({ children, delay = 0, as = 'div', className }: { children: ReactNode; delay?: number; as?: 'div' | 'section' | 'li'; className?: string })` renders `m[as]` with `initial={{ opacity: 0, y: 12 }}` and `animate={{ opacity: 1, y: 0 }}`, over 0.3 s ease-out, using `delay`.
- `RevealGroup` + `RevealItem` (client): the parent staggers its children by `stagger = 0.04` s, and each item uses the same fade-up as `Reveal`.

**Behaviour:**
- **StatusScreen, ExpiredBallot, privacy, slow-down:** wrap the main blocks in `Reveal`, with increasing delays of 0, 0.08 and 0.16 s.
- **Ballot:** the heading block is a `Reveal`, and the team grid is a `RevealGroup` with each `TeamCard` in a `RevealItem`. Keep `role="radiogroup"` on the grid element and `role="radio"` on the button.
- **TeamCard:**
  - When `selected` becomes true, the button animates `scale: [1, 1.04, 1]` (0.25 s) and the ✓ badge scales in from 0.
  - Use `m.button`, and keep all existing props and attributes.
- **PrimaryLink and the primary buttons:** add `active:scale-[0.97] transition-transform` (CSS only).
- **Leaderboard:**
  - rows become `m.li` with `layout` and keep their keys
  - bar fill animates `width` (0.5 s)
  - medals and text are unchanged
- **Ballot error box:** `m.div` sliding in with `initial={{ opacity: 0, y: 8 }}`.
- **ThankYou:** wrap the heading and the team card in `Reveal`, with delays of 0 and 0.12 s. The heading animates `scale` from 0.9.

- [ ] **Step 1: Failing test `tests/Reveal.test.tsx`:** `Reveal renders children` and `RevealGroup renders all items in order` (wrap them in `MotionProvider`).
- [ ] **Step 2:** Implement. Existing tests render these components without a provider and must still pass. `m.*` renders plain elements outside `LazyMotion`, so this works without changes. If a test needs animation features, wrap its render in `MotionProvider`.
- [ ] **Step 3:** All suites green, lint and build clean. **Step 4:** Commit: `feat(ui): entrance, selection and leaderboard motion`

---

### Task 3: Confirm-before-vote panel

**Files:**
- Create: `src/components/ConfirmVoteSheet.tsx`
- Modify: `src/components/BallotForm.tsx`
- Tests: `tests/ConfirmVoteSheet.test.tsx`, update `tests/BallotForm.test.tsx`

**Interfaces:**
- `ConfirmVoteSheet` (client): `({ team, open, submitting, onConfirm, onCancel }: { team: Team | null; open: boolean; submitting: boolean; onConfirm: () => void; onCancel: () => void })`
  - **Layout:** rendered through `AnimatePresence`.
    - The backdrop is a `m.div` fading to `bg-black/60`. Tapping it calls `onCancel`, but not while submitting.
    - The sheet is a `m.div` with `role="dialog"`, `aria-modal="true"` and `aria-labelledby`, springing up from `y: '100%'`.
    - The sheet is pinned to the bottom, `max-w-md` centred, `rounded-t-3xl bg-navy-light`, with bottom padding that respects `env(safe-area-inset-bottom)`.
  - **Content:**
    - a `TeamBadge` (size 72)
    - heading `Vote for {team.name}?`
    - line `You can only vote once, and it can't be changed.`
    - primary button `YES, CAST MY VOTE`, styled with `primaryButtonClass`. While submitting it shows the spinner and `Submitting…`, and is disabled.
    - text button `Change my pick`, hidden or disabled while submitting
  - **Focus:**
    - On open, focus moves to the YES button.
    - Tab and Shift+Tab cycle within the sheet.
    - Escape calls `onCancel`, but not while submitting.
    - On close, focus returns to the element that opened the sheet, which is the CAST MY VOTE button.
- **BallotForm changes:**
  - CAST MY VOTE (when enabled) now sets `confirmOpen = true` instead of submitting.
  - `onConfirm` runs the existing `handleSubmit` (the `inFlight` guard is unchanged).
  - On a failed result, set `confirmOpen = false`, then the existing error UI shows.
  - On success, leave the sheet open in its submitting state while the parent navigates.
  - The selected `Team` object is passed to the sheet.
  - The team cards stay disabled while submitting, as today.

- [ ] **Step 1: Failing tests in `tests/ConfirmVoteSheet.test.tsx`:**
  - `shows team copy and buttons` (exact copy)
  - `Change my pick calls onCancel`
  - `Escape calls onCancel`
  - `sheet cannot be dismissed while submitting` (`submitting=true`: Escape and a backdrop click don't call `onCancel`; YES is disabled and shows `Submitting…`)
  - `focus moves to YES on open`
- [ ] **Step 2: Update `tests/BallotForm.test.tsx`:**
  - Every flow that clicked CAST MY VOTE now also clicks `YES, CAST MY VOTE`.
  - `cast opens confirm without submitting` (`submit` not called after CAST)
  - `cancel returns to ballot with selection kept`
  - `confirm double-tap submits once` (click YES twice quickly; `submit` called once)
  - `failed submit closes sheet and shows error`
- [ ] **Step 3:** Implement. **Step 4:** All suites green, lint and build clean.
- [ ] **Step 5:** Commit: `feat(ballot): confirm-before-vote sheet`

---

### Task 4: Thank-you celebration

**Files:**
- Create: `src/lib/celebrate.ts`, `src/components/Celebration.tsx`
- Modify: `src/app/vote/[token]/BallotClient.tsx`, `src/components/ThankYou.tsx`, `src/app/thanks/page.tsx`, `src/lib/votes.ts`
- Tests: `tests/celebrate.test.ts`, `tests/Celebration.test.tsx`, update `tests/ThankYou.test.tsx`, extend the DB test for `getVoterVote` (in `tests/db/votes.test.ts`)

**Interfaces:**
- `src/lib/celebrate.ts`:
  - `CELEBRATE_KEY = 'dipl_celebrate'`
  - `markCelebrate(): void` writes `'1'` to `sessionStorage`
  - `consumeCelebrate(): boolean` returns true only if the flag is set, and removes it
  - Both are wrapped in try/catch (storage may be unavailable, and then they return false or no-op).
- `getVoterVote` returns `{ teamId, teamName, accentColor: string | null }`. Fetch `accent_color` with a second query, `from('teams').select('accent_color').eq('id', teamId).maybeSingle()`. There is no SQL function change.
- `BallotClient`: call `markCelebrate()` before `router.replace('/thanks')`.
- `ThankYou` gets `({ teamName, accentColor }: { teamName: string | null; accentColor?: string | null })` and renders `<Celebration colors={[accentColor ?? '#FFD21F', '#FFD21F', '#FFFFFF']} />`.
- `Celebration` (client):
  - **On mount:**
    1. If reduced motion is on (`matchMedia('(prefers-reduced-motion: reduce)')`) or `consumeCelebrate()` is false, do nothing.
    2. Otherwise `const confetti = (await import('canvas-confetti')).default`.
    3. Fire two bursts from the bottom corners, `origin {x:0,y:1}` angled 60° and `{x:1,y:1}` angled 120°, with `particleCount: 60` each, `spread: 55`, `startVelocity: 55`, and `ticks` tuned so it ends by about 2.5 s.
    4. Use `colors`, `disableForReducedMotion: true`, and z-index above the content.
  - **On unmount:** call `confetti.reset()`.
  - Renders `null`.
- `thanks/page.tsx` passes `accentColor={vote.accentColor}`.

- [ ] **Step 1: Failing tests:**
  - `tests/celebrate.test.ts`: `consumeCelebrate returns true once` and `consume without mark is false`
  - `tests/Celebration.test.tsx`:
    - mock `canvas-confetti`
    - `fires confetti when flagged`
    - `does not fire without flag` (refresh case)
    - `does not fire with reduced motion`
  - `tests/ThankYou.test.tsx` still passes, now with `accentColor`
  - DB: `getVoterVote includes accentColor`
- [ ] **Step 2:** Implement. **Step 3:** All suites green, lint and build clean.
- [ ] **Step 4:** Commit: `feat(thanks): confetti celebration once after voting`

---

## After all tasks: controller check (production build, Playwright 390×844)

1. **Ballot:**
   - the balls are visible behind the content
   - tapping empty space flicks a ball
   - tapping a team card selects it (the ball layer never intercepts)
   - CAST opens the sheet, Change my pick closes it, and YES votes
2. **Thank-you:** confetti fires, and a refresh shows no confetti.
3. **Reduced motion:** emulated reduced motion gives no loop and no confetti.
4. **Admin:** `/admin` has no canvas.
5. **Bundle:** record the JS transferred for `/vote/<token>` before (master at `dadf977`) and after. Growth must be ≤ about 45 KB gzipped, and canvas-confetti must not load on the ballot.
