# Organiser runbook

Plain-language steps for running the Doc IPL vote. Admin lives at `/admin` (log in with the admin password). Pages: Dashboard (`/admin`), Voting (`/admin/voting`), Teams (`/admin/teams`), Results (`/admin/results`).

## Before launch
1. Work through the Go-live checklist in the README (database, Turnstile keys, Vercel settings, secrets, deploy).
2. In Teams, check every team name and upload its logo.
3. In Voting, set "Max votes per device + network". To test, set the start to now and the end to later (India time) and press Save. The seeded window starts in the future, and paused or out-of-window phones only see the paused screen.
4. Press `RESUME VOTING` on `/admin/voting`.
5. Test on real phones via the DM link (see the manual checklist in `TEST-MATRIX.md`).
6. Press `PAUSE VOTING`.
7. Clear out test votes: go to the danger zone on the Results page (`/admin/results`) and run RESET (type `RESET`). It only works while voting is paused. Do this before launch, never during.
8. In Voting, set the real start and end time (India time) and press Save. Leave voting paused until launch, or press `RESUME VOTING` at launch time.
9. Put the link `https://<your-site>/v` into HeyDM. The host must be exactly the `NEXT_PUBLIC_SITE_URL` host, not another `*.vercel.app` alias: other hosts get 403 and fail Turnstile.

## Opening voting
1. In Voting, confirm the start and end times and press Save.
2. Press `RESUME VOTING` on `/admin/voting` to switch voting on. People can vote only while it is on and the time is inside the window.
3. Open `/v` yourself on a phone to check you reach the ballot.

## Watching
- `/admin` shows total votes, votes per team and the current status.
- `/results` is the live leaderboard. By default only admins can see it (log in first; voters are sent to the home page), and voters only see the vote page and their thank-you page. It refreshes by itself.
- To show results to everyone (e.g. when announcing the winner), press SHOW RESULTS TO PUBLIC on `/admin/results`. Voters then get a results link on the home, thank-you and closed screens. Press HIDE RESULTS FROM PUBLIC to hide them again (it can take ~15 seconds to disappear everywhere).
- In the Vercel logs, watch for: `[vote] no client IP header`, `turnstile_failed`, and bursts of 429 (too many requests) responses.

## Pausing in an emergency
Go to `/admin/voting` and press `PAUSE VOTING`. Visitors see a paused screen straight away. Press `RESUME VOTING` to resume. Saving the times never changes whether voting is on.

## If real people are blocked
Many phones on one mobile network can look like one person. If supporters report being blocked:
- Raise "Max votes per device + network" on `/admin/voting`, or
- Raise `RATE_LIMIT_MINT` / `RATE_LIMIT_VOTE` in Vercel env vars (format `max/seconds`, e.g. `120/600`) and redeploy.

Do not change `HASH_SECRET` during voting.

## Closing voting
Voting closes by itself at the end time. To close earlier, press `PAUSE VOTING` and set the end time to a minute ago (not "now").

## Export the results
On `/admin/results`, use "Download results CSV" and "Download votes CSV": the results table (team, votes, percent) and the all-votes file (team and time only). Do this before any purge.

## Announcing the results
Use the final numbers from `/results` or the results CSV. Check that the export matches what `/admin` shows before you post.

## After the event
- Within 30 days, run Purge identifiers (type `PURGE`) in the danger zone on the Results page (`/admin/results`), with voting paused. It deletes the stored device, IP and voter hashes and tokens but keeps the votes by team and time. The privacy notice promises this.
- Never resume voting after a purge: duplicate checks no longer work.

## Rotating the admin secret
Change `ADMIN_SESSION_SECRET` in Vercel and redeploy. Everyone is logged out, including anyone who should not have access. To change the password, change `ADMIN_PASSWORD` the same way. Use at least 8 characters for the password (longer and random is safer) and 32+ random bytes for the secret.
