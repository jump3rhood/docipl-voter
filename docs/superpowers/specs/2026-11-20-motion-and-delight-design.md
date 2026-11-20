# Doc IPL Voting — Motion & Delight (short design)

**Date:** 2026-11-20 · **Size:** small change (public UI only)

## Intent
The public voting pages should feel lively and polished, not static, while staying fast on phones opening the link from an Instagram DM, including the in-app browser on mid-range Android. The user asked for:
- tasteful motion across the public pages
- floating pickleballs in the background that people can interact with, without hurting performance
- a confirmation step before a vote is cast
- a confetti-style celebration with the thank-you message

## Goals
- Motion on the public pages: home/status screens, ballot, thank-you, results, privacy, slow-down and expired screens.
- A background of floating pickleballs. **Tap to flick** (the user's choice): tapping empty background flicks the nearest ball away with a spin and nudges its neighbours.
- A confirmation panel between CAST MY VOTE and the actual submit.
- A confetti burst with the thank-you message, right after voting.

## Non-goals
- Admin pages: no balls, no new motion.
- Vote logic, anti-abuse, API and DB: no changes.
- No sound, no desktop layouts (mobile-only stays).

## Anti-goals (a failure even if it "works")
- The ballot appears noticeably later, or taps on team cards or buttons ever hit a ball instead.
- Balls or animation make text hard to read, or stutter or heat up cheaper phones.
- Confetti replays every time someone refreshes the thank-you page.

## Approaches considered
| | What | Trade-off |
|---|---|---|
| A | Everything hand-built, no new libraries | Smallest download; more custom code |
| **B (chosen by the user)** | **Motion** (React animation library) for page and UI motion, plus **canvas-confetti** for the burst; pickleballs hand-built on one canvas | Faster to polish transitions; adds roughly 20–40 KB for voters |
| C | Physics engine (e.g. matter.js) for the balls | About 80 KB and the most stutter risk; overkill for decoration |

## Design

### Libraries (decided: B)
- `motion` (import from `motion/react`). Use `LazyMotion` + `domAnimation` + `m.*` components to keep the cost down, adding `layout` only where needed.
- `canvas-confetti`. Load it with a dynamic `import()` on the thank-you page only, so the ballot never pays for it.

### Floating pickleballs (`PickleballField`, client component)
- **Where it's mounted:** a single full-screen `<canvas>` behind all content, in the root layout. It isn't rendered on `/admin` paths (checked with `usePathname`). `pointer-events: none`, so it never steals taps.
- **The balls:** 8 of them, or 5 when `navigator.hardwareConcurrency <= 4`. They're brand-yellow pickleballs with holes, 28–56 px, and 35–60% opacity so content stays readable. They drift slowly with a gentle spin and wrap or bounce at the screen edges.
- **Tap to flick:**
  - A `pointerdown` listener on `window` ignores taps on interactive elements (`button, a, input, [role=radio], [role=dialog]` and their children).
  - Otherwise the nearest ball within about 120 px gets an impulse away from the finger, plus spin, and balls within about 80 px of it get a smaller nudge.
  - Velocity decays back to the gentle drift.
  - It never calls `preventDefault`, so scrolling is unaffected.
- **Performance:**
  - One `requestAnimationFrame` loop, with the ball sprite pre-rendered once to an offscreen canvas and drawn with `drawImage` plus rotation.
  - Device pixel ratio capped at 2, canvas resized only on `resize`.
  - Paused when the tab is hidden (`visibilitychange`), and started after first paint (`requestIdleCallback`, falling back to `setTimeout`) so it doesn't delay the ballot.
  - If `getContext('2d')` is unavailable (as in jsdom tests), it renders nothing.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the balls are drawn once in fixed positions, with no loop and no flicking.

### Page motion
- **Entrances:** content on the public screens fades up (about 300 ms, ease-out). On the ballot, the heading comes first, then the team cards stagger in about 40 ms apart.
- **Selecting a team:** the selected card gives a small spring "pop" (scale to about 1.04 and back), and its ✓ badge scales in.
- **Buttons:** primary buttons press down slightly when tapped (scale about 0.97).
- **Results:** leaderboard rows animate smoothly to their new position when the ranking changes on a refresh (Motion `layout`), and bar widths animate.
- **Errors:** the error box on the ballot slides in.
- **Reduced motion:** Motion's `MotionConfig reducedMotion="user"` turns movement into simple fades.

### Confirmation panel (ballot)
- **Opening it:** tapping CAST MY VOTE (when enabled) opens a bottom sheet over a dimmed backdrop instead of submitting straight away.
  - It slides up with a spring.
  - It's `role="dialog"` with `aria-modal`.
  - Focus moves into it and stays there, and Escape, tapping the backdrop or "Change my pick" closes it.
- **What it shows:**
  - The chosen team's badge and name.
  - Title: **"Vote for {Team}?"**
  - Line: **"You can only vote once, and it can't be changed."**
  - Primary button: **"YES, CAST MY VOTE"** (yellow). It runs the existing submit; the sheet shows the spinner/"Submitting…" state and can't be dismissed while sending.
  - Text button: **"Change my pick"**.
- **When the submit fails:** the sheet closes and the existing error box shows, exactly as today.
- **Turnstile and "Verifying…":** behaviour is unchanged. CAST MY VOTE stays disabled until verification is ready, so the sheet can only open when a submit is possible.

### Thank-you celebration
- **Confetti:** right after a successful vote, a 2.5 s confetti burst fires from both bottom corners in the voted team's accent colour, plus brand yellow and white. About 120 particles, removed when done.
- **Message:** the thank-you heading pops in, then the "You voted for" card scales in with a short stagger.
- **Playing once:** confetti plays only on the arrival straight after voting. The ballot sets a one-time `sessionStorage` flag (`dipl_celebrate`), and the thank-you page consumes and clears it. Refreshes and later visits show the message without confetti. *(Builder's call.)*
- **Team colour:** the thank-you page has the team name, so it also needs the accent colour. Extend the existing `getVoterVote` result to include the team's `accent_color`, which is a read-only change.
- **Reduced motion:** no confetti, and the message simply fades in.

## Constraints
- Next.js 16 App Router conventions in this repo (`cacheComponents`; client components for anything animated). Read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- Mobile-only, 390×844 reference viewport. Brand: navy `#0B2A5B`, yellow `#FFD21F`.
- **Keep it light:** the ballot page's JS must grow by no more than about 45 KB gzipped (the builder measures it before and after from the build output). Confetti is lazy-loaded.
- **Tests:** all existing suites stay green. BallotForm tests are updated for the confirm step, and new tests cover the sheet's open/confirm/cancel/Escape behaviour, the celebrate-once flag, and the ball field rendering nothing without a canvas context.

## Left to the builder
Exact easing and durations, ball sprite drawing details, how the per-screen entrance wrapper is structured, and the confetti particle settings within the limits above.
