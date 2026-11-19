# Doc IPL People's Choice

Mobile-first Next.js + Supabase voting app for a one-weekend Instagram campaign. HeyDM sends everyone the same DM link (`https://<host>/v`), which mints a one-time ballot token. Design: [docs/superpowers/specs/2026-11-19-docipl-voting-design.md](docs/superpowers/specs/2026-11-19-docipl-voting-design.md).

## Status

Phases 1-2 are done: project scaffold, database schema and voting functions. The ballot UI, vote API, results and admin area are upcoming, so the `/v` link does not work yet.

## Local setup

Requires Node.js and Docker Desktop (for the local Supabase stack).

```bash
npm i
npm run db:start                  # start local Supabase (Docker must be running)
node scripts/write-test-env.mjs   # writes .env.test.local for DB tests
npm test                          # unit tests
npm run test:db                   # database tests against local Supabase
cp .env.example .env.local        # then fill in values
npm run dev
```

Other scripts: `npm run db:reset` (reapply migrations and seed), `npm run db:types` (regenerate DB types), `npm run lint`, `npm run build`.

For local dev, Cloudflare Turnstile test keys work (see comments in `.env.example`).

## Go-live checklist

1. Create a free Supabase project.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`. Check that it applies all 3 migrations in `supabase/migrations/`, then run the Supabase advisors (Dashboard → Advisors, security and performance) and fix anything they flag.
3. Run `supabase/seed.sql` once in the Supabase SQL editor.
4. Create a Cloudflare Turnstile widget whose only hostname is the exact production host (e.g. `<project>.vercel.app`). Use a separate widget (or the test keys) for `localhost`. In production, a token issued for any other hostname is rejected.
5. Use real (non-test) Turnstile keys in production. The app refuses to start on `VERCEL_ENV=production` with the `1x0000…`/`2x0000…`/`3x0000…` test keys.
6. Generate `HASH_SECRET` once (`openssl rand -hex 32`). Never rotate it during voting: every IP, device and voter hash would change, so duplicate checks and per-device caps would reset.
7. Set the Vercel env vars from `.env.example`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-only; never expose them to the browser.
8. Deploy to Vercel. Do not put a Cloudflare proxy (orange cloud) in front of Vercel: the client IP is read from `x-forwarded-for`, which a proxy would replace with its own address. If you add one, switch IP extraction to `cf-connecting-ip` first.
9. Before announcing, do a real-device run with the production keys: send the link by Instagram DM to an iPhone and an Android phone, open it in the in-app browser, then use "Open in browser", and try back and refresh on the ballot and thank-you pages.

### During voting

- Watch the Vercel logs for `[vote] no client IP header`, `turnstile_failed` responses and spikes of 429s. If Indian mobile carriers' CGNAT (many people behind one IP) causes false blocks, raise `RATE_LIMIT_MINT` / `RATE_LIMIT_VOTE` or the per-device cap (`max_votes_per_device_ip`).
- To pause voting, set `is_enabled = false` in the `voting_config` row (Supabase Table Editor). Set it back to `true` to resume.
- Link-preview crawlers (Instagram, WhatsApp) may open `/v` and mint ballot tokens that are never used. That is harmless: tokens expire and do not count as votes.

### Accepted residual risk

Scripted voting backed by a CAPTCHA-solving service is bounded only by Turnstile and the per-IP rate limits and device cap. Each vote still needs a fresh ballot token and a solved Turnstile challenge.

Start on the free `*.vercel.app` domain. To move to a custom domain later, only update `NEXT_PUBLIC_SITE_URL` and the Turnstile widget hostname.

## Instagram/HeyDM link

The DM link is `https://<host>/v`. Send the same link to everyone; each visitor gets their own one-time ballot token.
