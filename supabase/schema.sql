-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: the table is created if missing and seed rows are skipped if they exist.

create table if not exists public.jobs (
  id             text primary key,            -- URL slug, e.g. 'henchperson'
  title          text not null,
  summary        text not null,
  pay            text not null,
  benefits       text[] not null default '{}',
  qualifications text[] not null default '{}',
  location       text not null,
  disclaimers    text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- Row Level Security: anyone can read jobs; no public writes.
-- Writes will come later from an authenticated admin or the service role.
alter table public.jobs enable row level security;

drop policy if exists "Public can read jobs" on public.jobs;
create policy "Public can read jobs"
  on public.jobs
  for select
  to anon, authenticated
  using (true);

-- Seed data (the former mock jobs)
insert into public.jobs
  (id, title, summary, pay, benefits, qualifications, location, disclaimers)
values
  ('henchperson',
   'Henchperson',
   'Stand menacingly in corridors, guard things of unspecified importance, and never ask what is in the crates.',
   '$38,000 - $48,000 per year, plus combat pay',
   array['Medical coverage (no questions asked about how it happened)', 'Dental (replacement teeth included)', 'Matching uniform allowance', 'Free lunch on days the lair is not under attack'],
   array['Comfortable standing for long periods', 'Able to follow orders without follow-up questions', 'Willingness to be defeated by a hero in the first act'],
   'Various secret bases (assigned on first day)',
   array['The Garden is not liable for injuries caused by heroes, lasers, or sharks.', 'Henchperson turnover is high; this is not a reflection of management.']),
  ('lair-facilities-manager',
   'Lair Facilities Manager',
   'Keep the volcano stable, the shark tanks filtered, and the trapdoors properly oiled.',
   '$72,000 - $95,000 per year',
   array['Full health coverage (excluding volcano-related incidents)', 'Hard hat provided', 'Annual shark-tank maintenance bonus'],
   array['5+ years managing large industrial or geothermal facilities', 'Working knowledge of aquatic predator husbandry', 'Valid hazardous materials certification'],
   'Hollowed-out volcano, Pacific Ring of Fire',
   array['Volcano eruptions are considered an act of villainy, not an act of nature.', 'Candidates must be able to swim.']),
  ('chief-doomsday-device-engineer',
   'Chief Doomsday Device Engineer',
   'Design, build, and calibrate the Garden''s flagship device. Must be comfortable with deadlines that are, technically, the end of the world.',
   '$180,000 - $250,000 per year, plus equity in the new world order',
   array['Premium health, dental, and vision', 'Private lab with blast doors', 'Guaranteed survival in the post-doomsday shelter'],
   array['PhD in physics, engineering, or a closely related forbidden field', 'Track record of delivering world-altering projects on schedule', 'Strong written and verbal communication, including ultimatums'],
   'Orbital platform (remote work not available)',
   array['Equity value may drop to zero in the event of a successful launch.', 'The Garden does not guarantee the continued existence of the surrounding planet.']),
  ('minion-wrangler',
   'Minion Wrangler',
   'Coordinate shifts, snacks, and morale for several hundred enthusiastic minions.',
   '$55,000 - $70,000 per year',
   array['Unlimited banana-adjacent snacks', 'Noise-canceling headphones', 'Paid time off after major incidents'],
   array['Experience supervising large, loud teams', 'Patience of a saint, or at least a very stubborn supervillain', 'Fluency in Minionese preferred'],
   'Central Garden headquarters, Sub-basement 4',
   array['Minions are not responsible for damage caused by minions.', 'Position may involve being covered in goggles and overalls.']),
  ('monologue-writer',
   'Monologue Writer',
   'Craft compelling villain speeches that are long enough to be dramatic but short enough to avoid fatal interruptions.',
   '$60,000 - $85,000 per year, plus per-speech royalties',
   array['Flexible hours (mostly dramatic late-night ones)', 'Remote-friendly via encrypted channel', 'Complimentary cape'],
   array['Portfolio of at least three unhinged speeches', 'Strong sense of pacing and menace', 'Ability to write while a villain paces behind you'],
   'Hybrid: headquarters library or an undisclosed remote location',
   array['Speeches are delivered at the client''s own risk.', 'The Garden is not liable if a hero escapes during the monologue.'])
on conflict (id) do nothing;
