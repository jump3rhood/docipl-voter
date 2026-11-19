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
