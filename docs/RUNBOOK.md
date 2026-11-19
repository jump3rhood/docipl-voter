# Organiser runbook

Plain-language steps for running the Doc IPL vote. Admin lives at `/admin` (log in with the admin password). Pages: Dashboard (`/admin`), Voting (`/admin/voting`), Teams (`/admin/teams`), Results (`/admin/results`).

## Before launch
- Work through the Go-live checklist in the README (database, Turnstile keys, Vercel settings, secrets).
- In Teams, check every team name and upload its logo.
- In Voting, set the real start and end time (India time) and the device cap. Leave voting paused for now.
- Test on real phones (see the manual checklist in `TEST-MATRIX.md`).
- Clear out test votes: pause voting, go to the danger zone on the Voting page and run RESET (type `RESET`). It only works while voting is paused. Do this before launch, never during.
- Put the link `https://<your-site>/v` into HeyDM.

## Opening voting
1. In Voting, confirm the start and end times and press Save.
2. Switch voting on with the toggle. People can vote only while it is on and the time is inside the window.
3. Open `/v` yourself on a phone to check you reach the ballot.

## Watching
- `/admin` shows total votes, votes per team and the current status.
- `/results` is the public live leaderboard; it refreshes by itself.
- In the Vercel logs, watch for: `[vote] no client IP header`, `turnstile_failed`, and bursts of 429 (too many requests) responses.

## Pausing in an emergency
Go to Voting and switch the toggle off. Visitors see a paused screen straight away. Switch it back on to resume. Saving the times never changes the toggle.

## If real people are blocked
Many phones on one mobile network can look like one person. If supporters report being blocked:
- Raise the device cap on the Voting page, or
- Raise `RATE_LIMIT_MINT` / `RATE_LIMIT_VOTE` in Vercel env vars (format `max/seconds`, e.g. `120/600`) and redeploy.

Do not change `HASH_SECRET` during voting.

## Closing voting
Voting closes by itself at the end time. To close earlier, switch the toggle off and set the end time to now.

## Export the results
On Results, download both CSVs: the results table (team, votes, percent) and the all-votes file (team and time only). Do this before any purge.

## Announcing the results
Use the final numbers from `/results` or the results CSV. Check that the export matches what `/admin` shows before you post.

## After the event
- Within 30 days, run Purge identifiers (type `PURGE`) in the danger zone, with voting paused. It deletes the stored device, IP and voter hashes and tokens but keeps the votes by team and time. The privacy notice promises this.
- Never resume voting after a purge: duplicate checks no longer work.

## Rotating the admin secret
Change `ADMIN_SESSION_SECRET` in Vercel and redeploy. Everyone is logged out, including anyone who should not have access. To change the password, change `ADMIN_PASSWORD` the same way. Use 20+ random characters for the password and 32+ random bytes for the secret.
