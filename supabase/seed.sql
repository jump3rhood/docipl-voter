insert into public.teams (name, slug, accent_color, logo_url, display_order) values
  ('Smash Squad 2.0', 'smash-squad', '#F97316', '/teams/smash-squad.webp', 1),
  ('Jäger Shots', 'jager-shots', '#22C55E', '/teams/jager-shots.webp', 2),
  ('Code Red', 'code-red', '#EF4444', '/teams/code-red.webp', 3),
  ('The Rush', 'the-rush', '#A855F7', '/teams/the-rush.webp', 4),
  ('Dink N Drive', 'dink-n-drive', '#14B8A6', '/teams/dink-n-drive.webp', 5),
  ('Spin Mavericks', 'spin-mavericks', '#EC4899', '/teams/spin-mavericks.webp', 6),
  ('Code Blue', 'code-blue', '#3B82F6', '/teams/code-blue.webp', 7),
  ('White Coat Warriors', 'white-coat-warriors', '#E5E7EB', '/teams/white-coat-warriors.webp', 8),
  ('The Pacemakers', 'the-pacemakers', '#84CC16', '/teams/the-pacemakers.webp', 9),
  ('VDC Spartans', 'vdc-spartans', '#B45309', '/teams/vdc-spartans.webp', 10),
  ('Dinking Dragons', 'dinking-dragons', '#6366F1', '/teams/dinking-dragons.webp', 11);

insert into public.voting_config (id, voting_start, voting_end, is_enabled, max_votes_per_device_ip)
values (1, '2026-11-21 09:00+05:30', '2026-11-22 21:00+05:30', false, 3);
