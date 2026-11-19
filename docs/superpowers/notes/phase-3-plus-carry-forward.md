# Carry-forward for Phases 3–8

Collected from the Phase 1–2 reviews. Each later plan must account for the items that apply to it.

## Vote API / anti-abuse (Phases 4–5)
- Always pass a real `p_ip_hash` to `cast_vote`/`mint_token`. Null or empty hashes fall into a shared `'none'` bucket. If the IP header is missing (for example behind an unexpected proxy) and the device signal is also missing, every such voter shares one cap of 3. Log or alert when no client IP is found.
- Missing or malformed device signal: send null. The DB maps it to `'none'`, so leaving it out can't skip the cap.
- Generated types mark `cast_vote.team_id/team_name` and `get_results.logo_url/accent_color` as non-null, but they can be null. Wrappers must narrow these.
- `rate_limit_hit` raises on invalid params. Treat any RPC error as a failure; never swallow it.
- `next.config.ts` has `cacheComponents: true`. Pages and route handlers that read cookies, headers or the DB need `await connection()` or Suspense boundaries, or the build fails.

## UI (Phases 3 & 6)
- `get_results` gives tied teams the same rank (all 11 are rank 1 when there are no votes). Show medals only when `votes > 0`.
- `voting_state()` returns `before` when an admin disables voting mid-window. The status screen should say "Voting is paused" when `start <= now`, rather than "opens soon".
- Starter styling to fix: `themeColor` is dark while the page background is white, and `globals.css` forces Arial over the loaded Geist font.

## Admin (Phase 7)
- Add a migration for the public Storage bucket `team-logos`.
- Purge works now (`votes.voter_id/token_id` are `on delete set null`). After a purge, a purged browser could vote again, so only purge after voting closes.

## Optional cleanup
- Unused `create extension pgcrypto`; nullable `rate_limits.count` and `created_at` columns (cosmetic).
- Run the Supabase security and performance advisors on the hosted project after `db push`.

## From Phase 3 final review
- Phase 4 `/api/vote` contract: success is `{ ok: true, teamName: string }` (always include `teamName`; the generated types wrongly mark `cast_vote` `team_name` as non-null). Errors are `{ ok: false, code }` with `code` from `VOTE_ERROR_CODES` (`src/lib/voteMessages.ts`). The DB status `token_used` must map to `already_voted`.
- Add a branded `app/error.tsx` with a retry button.
- `/thanks` must be gated by the voter cookie in Phase 5 (Suspense + `connection()`).
- Turnstile: BallotForm needs a `canSubmit` gate (no submit until the widget has a token), and the widget must be reset after every failed submit.
- `/vote/[token]` needs a page title and an empty-team-list message.
- `/v` becomes a token-minting route handler: every link to it must stay a plain `<a>` (no `next/link` prefetch).

## From Phase 4+5 final review (open items, non-blocking)
- **Turnstile watchdog vs. a visible challenge:** the 12s timeout can reset a checkbox challenge the user hasn't clicked yet, and the "taking too long" notice can appear beside a working widget. Fix: stop the watchdog in `before-interactive-callback` and restart it in `after-interactive-callback`. Worth doing before go-live, because Instagram's in-app browser triggers interactive challenges more often.
- **Late script after the 10s timeout:** the widget never renders and only Reload recovers. Acceptable, since the notice is shown.
- **Origin check on Vercel Preview:** off production, compare against `req.nextUrl.origin` rather than `SITE_URL`. Otherwise previews 403 every vote.
- **README go-live additions:**
  - `NEXT_PUBLIC_SITE_URL` must equal the production origin exactly (scheme + host, no path), or every vote returns 403.
  - Preview deployments must use a separate Supabase project (or no DB env vars), and Vercel Deployment Protection must stay on for previews.
  - Keep Vercel's "Automatically expose System Environment Variables" on, because the `VERCEL_ENV` checks depend on it.
- **Logging:** add a `console.warn` on the 415 and Origin rejections, which both return `token_invalid`, to make misconfiguration debuggable.
- **Deferred:** content-length early reject; rate limiting on GET `/vote/[token]` and `/thanks` (use the Vercel firewall); widget and BallotClient reset tests (cover with a real-device check); a test for the ok-with-null-teamName path.
