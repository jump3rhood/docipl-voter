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
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Run `supabase/seed.sql` once in the Supabase SQL editor.
4. Create a Cloudflare Turnstile widget for `<project>.vercel.app` and `localhost`.
5. Set the Vercel env vars from `.env.example`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-only; never expose them to the browser.
6. Deploy to Vercel.

Start on the free `*.vercel.app` domain. To move to a custom domain later, only update `NEXT_PUBLIC_SITE_URL` and the Turnstile widget hostname.

## Instagram/HeyDM link

The DM link is `https://<host>/v`. Send the same link to everyone; each visitor gets their own one-time ballot token.
