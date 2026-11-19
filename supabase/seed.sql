insert into public.teams (name, slug, accent_color, logo_url, display_order) values
  ('Team 1',  'team-1',  '#E6194B', null, 1),
  ('Team 2',  'team-2',  '#3CB44B', null, 2),
  ('Team 3',  'team-3',  '#4363D8', null, 3),
  ('Team 4',  'team-4',  '#F58231', null, 4),
  ('Team 5',  'team-5',  '#911EB4', null, 5),
  ('Team 6',  'team-6',  '#42D4F4', null, 6),
  ('Team 7',  'team-7',  '#F032E6', null, 7),
  ('Team 8',  'team-8',  '#9A6324', null, 8),
  ('Team 9',  'team-9',  '#469990', null, 9),
  ('Team 10', 'team-10', '#808000', null, 10),
  ('Team 11', 'team-11', '#800000', null, 11);

insert into public.voting_config (id, voting_start, voting_end, is_enabled, max_votes_per_device_ip)
values (1, '2026-11-21 09:00+05:30', '2026-11-22 21:00+05:30', false, 3);
