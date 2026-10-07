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

-- Additional jobs
insert into public.jobs
  (id, title, summary, pay, benefits, qualifications, location, disclaimers)
values
  ('mad-scientist',
   'Mad Scientist',
   'Conduct unethical research, invent unlikely contraptions, and laugh maniacally when experiments succeed. Ethics review boards are not provided.',
   '$120,000 - $160,000 per year, plus patent royalties on all world-threatening inventions',
   array['Fully equipped underground laboratory', 'Lightning rod installation at no cost', 'Hazard pay for experiments that go slightly wrong', 'Complimentary lab coat with goggles'],
   array['PhD in a hard science (honorary degrees accepted with a good explanation)', 'Experience building prototypes that violate at least one law of physics', 'Comfortable working during thunderstorms', 'Willingness to ignore the phrase "this was a bad idea"'],
   'Secret underground laboratory (location classified)',
   array['The Garden is not responsible for creatures that escape the laboratory.', 'Experimental results may vary, including unintended sentience.']),
  ('human-resources-manager',
   'Human Resources Manager',
   'Handle onboarding, payroll, and workplace disputes for a workforce of henchpeople, scientists, and minions. Exit interviews are conducted near the trapdoor.',
   '$68,000 - $88,000 per year',
   array['Comprehensive medical, dental, and vision', 'Soundproofed office', 'Panic button under the desk (functionality not guaranteed)', 'Generous paid time off, subject to the world domination schedule'],
   array['Bachelor''s degree in human resources or a related field', '3+ years in HR, preferably with high-turnover workforces', 'Ability to mediate disputes between rival henchpeople', 'Discretion with confidential information, including secret identities'],
   'Central Garden headquarters, Floor 2 (no windows)',
   array['HR cannot intervene in disputes with the Director of Villainy.', 'Complaints about shark tank safety are filed under "ongoing".'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user (created automatically on sign-up)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           text not null default 'candidate' check (role in ('candidate', 'admin')),
  display_name   text,
  first_name     text,
  last_name      text,
  -- id of the uploaded resume's row in storage.objects (Supabase Storage).
  -- Deliberately no foreign key: storage.objects is managed by Supabase.
  resume_id      uuid,
  phone_number   text,
  evil_nickname  text,
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admin check as a security definer function so policies on profiles can use
-- it without recursing into their own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may edit their own details but must never be able to change their
-- role (or id). Column-level grants enforce this on top of RLS.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, first_name, last_name, resume_id, phone_number, evil_nickname)
  on public.profiles to authenticated;

-- Create a profile whenever someone signs up. Optional name fields can be passed
-- at sign-up via options.data. Role is NEVER read from user metadata, because
-- users control that; everyone starts as 'candidate'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles
    (id, display_name, first_name, last_name, phone_number, evil_nickname)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'evil_nickname'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this ran.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- To make someone an admin, run (as the SQL Editor's postgres role):
--   update public.profiles set role = 'admin' where id = '<user uuid>';
