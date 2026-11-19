# Test matrix (brief section 18)

Automated tests: `npm test` (unit) and `npm run test:db` (needs Docker and local Supabase). File paths are relative to the repo root. "Manual" means a real-device check is required before launch.

| Item | Automated coverage (file: test name) | Manual |
|---|---|---|
| Duplicate voting | tests/db/functions.test.ts: `same browser second token → already_voted`; `device+ip cap 3`; tests/db/route-vote.test.ts: `api: same cookie, second token → 409 already_voted`, `api: device cap via API` | no |
| Expired token | tests/db/functions.test.ts: `rejects time-expired token`, `mint expiry capped at voting_end`; tests/ExpiredBallot.test.tsx: `renders expiry copy and a plain anchor to /v` | no |
| Reused token | tests/db/functions.test.ts: `reused token → token_used`; tests/db/route-vote.test.ts: `api: reused token → 409 already_voted` | no |
| Before start | tests/db/functions.test.ts: `voting_state: disabled before end → before; past end → closed; open window → open`, `mint refused when not open`, `disabled window rejects vote`; tests/StatusScreen.test.tsx: `before shows start time` | no |
| After end | tests/db/functions.test.ts: `closed window rejects vote`, `mint refused when closed`; tests/db/route-vote.test.ts: `api: closed window → 403 voting_closed`; tests/db/route-v.test.ts: `closed -> / and no token` | no |
| Invalid team | tests/db/functions.test.ts: `invalid team leaves token active`, `nonexistent team id → invalid_team`; tests/db/route-vote.test.ts: `api: inactive team → 422 invalid_team, token still active` | no |
| Invalid Turnstile | tests/db/route-vote.test.ts: `api: turnstile fail keeps token active`; tests/turnstile.test.ts: `success false -> false`, `production: other hostname -> false` | no |
| Rate limiting | tests/db/functions.test.ts: `rate_limit_hit`; tests/db/votes.test.ts: `rateLimitHit allows then blocks per env limit`; tests/db/route-vote.test.ts: `api: rate limited → 429`; tests/db/route-v.test.ts: `rate limited -> /slow-down`; tests/db/admin-login.test.ts: `adminLogin bucket respects RATE_LIMIT_ADMIN_LOGIN (3/900)` | no |
| Refresh after voting | tests/db/route-v.test.ts: `voted cookie -> /thanks, no new token`; tests/ThankYou.test.tsx: `ThankYou shows team` | yes (real browser refresh and back) |
| Multiple browsers | tests/db/functions.test.ts: `cast_vote concurrency: device+ip cap of 1 across distinct browsers`; tests/db/route-v.test.ts: `open, no cookie -> /vote/<token>, sets cookie, token active`; tests/db/load.test.ts: `api load: 50 concurrent distinct voters` | no |
| Mobile Safari | Partial only: tests/BallotForm.test.tsx: `submits selected team and calls onVoted`; tests/deviceSignal.test.ts: `returns null when crypto.subtle throws` | **yes** |
| Chrome Android | Partial only: same component tests as above | **yes** |
| Instagram in-app browser (iOS, Android) and "Open in browser" | Partial: tests/StatusScreen.test.tsx: `VOTE NOW is a plain anchor (no Next Link prefetch of the token-minting route)`; tests/BallotForm.test.tsx: `token_invalid link is a plain anchor`; tests/TurnstileWidget.test.tsx: `times out without any interaction` | **yes** |
| Slow network | Partial: tests/BallotForm.test.tsx: `a rejecting submit shows the network message and keeps selection`, `submits once on double click`; tests/submitVote.test.ts: `network failure → generic error` | **yes** (Chrome DevTools "Slow 4G") |
| Simultaneous votes | tests/db/functions.test.ts: `cast_vote concurrency`, `cast_vote concurrency: same browser, different tokens`; tests/db/route-vote.test.ts: `api: concurrent same token`; tests/db/load.test.ts: `api load: 10 concurrent requests on one token`, `api load: same cookie, 10 concurrent tokens`, `api load: device cap under concurrency` | no |

## Other automated coverage
- Load tests: tests/db/load.test.ts checks correctness under concurrency, in-process, with high mocked rate limits. It is not capacity testing of Vercel or Supabase.
- Admin auth and session: tests/adminSession.test.ts, tests/adminActions.test.ts (`rate limited: error, no cookie, even with the right password`, `correct password sets session cookie and redirects`, `deletes cookie with path / and redirects to login`).
- Admin actions and export: tests/db/admin-actions-voting.test.ts, tests/db/admin-actions-teams.test.ts, tests/db/admin-export.test.ts (`401 without cookie`, `reset needs RESET`, `reset refused while enabled`, `purge needs PURGE, refused while enabled, keeps votes`), tests/db/admin.test.ts.
- Results: tests/db/results.test.ts, tests/db/route-results.test.ts, tests/Leaderboard.test.tsx.
- Vote API hardening: tests/db/route-vote.test.ts (`api: foreign Origin -> 403 token_invalid; same origin ok`, `api: production origin must match SITE_URL`, `api: non-JSON content-type -> 415 token_invalid, token untouched`).
- Schema and access: tests/db/schema.test.ts (`anon is locked out`), tests/db/functions.test.ts (`anon cannot rpc`).

## Manual real-device checklist
Use production (or production-like) Turnstile keys. Tick each on every device.
- [ ] iPhone Safari: open the DM link, vote, see the thank-you page with your team.
- [ ] Android Chrome: same.
- [ ] Instagram in-app browser on iPhone and on Android: open the DM link from a real DM, vote.
- [ ] From the in-app browser use "Open in browser" and confirm the flow still works (a second vote from the same phone is refused).
- [ ] Refresh and use Back on the ballot and thank-you pages: you stay on or return to the thank-you page and cannot vote twice.
- [ ] Chrome DevTools, Network throttling "Slow 4G": ballot loads, Turnstile completes, vote submits once, no double count.
- [ ] A paused or closed state shows the right screen on a phone.
