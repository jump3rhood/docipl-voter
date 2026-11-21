-- Official team logos, served as static files from public/teams/ (no Storage egress).
update public.teams set logo_url = '/teams/' || slug || '.webp'
where slug in (
  'smash-squad', 'jager-shots', 'code-red', 'the-rush', 'dink-n-drive', 'spin-mavericks',
  'code-blue', 'white-coat-warriors', 'the-pacemakers', 'vdc-spartans', 'dinking-dragons'
);

-- Match the spelling on the team's logo.
update public.teams set name = 'Jäger Shots' where slug = 'jager-shots';
