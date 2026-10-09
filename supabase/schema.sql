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

-- ---------------------------------------------------------------------------
-- Applications: a candidate applying to a job
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  -- restrict: a job with applications can't be deleted by accident.
  job_id         text not null references public.jobs (id) on delete restrict,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'submitted'
                   check (status in ('submitted', 'reviewing', 'interviewing', 'offered', 'rejected', 'withdrawn')),
  -- An employee's id, entered by the candidate. Free text for now: there is no
  -- employees table to validate against yet.
  referral_code  text check (referral_code is null or char_length(referral_code) <= 50),
  -- Copy of the candidate's profiles.resume_id at the moment they applied.
  resume_id      uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (job_id, user_id)
);

create index if not exists applications_user_id_idx on public.applications (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

drop policy if exists "Candidates can read own applications" on public.applications;
create policy "Candidates can read own applications"
  on public.applications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all applications" on public.applications;
create policy "Admins can read all applications"
  on public.applications for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update applications" on public.applications;
create policy "Admins can update applications"
  on public.applications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No direct writes for candidates: they apply and withdraw through the
-- functions below. Only the status column is updatable, and only admins have a
-- policy that allows it.
revoke insert, update, delete on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant update (status) on public.applications to authenticated;

-- Apply to a job (or re-apply after withdrawing). Returns the application id.
create or replace function public.apply_to_job(
  p_job_id text,
  p_referral_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in to apply.';
  end if;

  insert into public.applications (job_id, user_id, referral_code, resume_id)
  values (
    p_job_id,
    v_user,
    nullif(left(btrim(p_referral_code), 50), ''),
    (select resume_id from public.profiles where id = v_user)
  )
  on conflict (job_id, user_id) do update
    set status = 'submitted',
        referral_code = excluded.referral_code,
        resume_id = excluded.resume_id
    where public.applications.status = 'withdrawn'
  returning id into v_id;

  -- The conflict branch only fires for withdrawn applications.
  if v_id is null then
    raise exception 'You have already applied to this job.';
  end if;

  return v_id;
end;
$$;

-- Withdraw one of your own applications (not once it has been rejected).
create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.applications
     set status = 'withdrawn'
   where id = p_application_id
     and user_id = (select auth.uid())
     and status in ('submitted', 'reviewing', 'interviewing', 'offered');

  if not found then
    raise exception 'Application not found, or it can no longer be withdrawn.';
  end if;
end;
$$;

revoke execute on function public.apply_to_job(text, text) from public, anon;
revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.apply_to_job(text, text) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;


-- HR chatbot: vector search over the HR docs (pgvector).
-- Filled by `npm run ingest` (scripts/ingest-hr-docs.ts) using the service-role key.
-- The vector size must match EMBEDDING_DIMENSIONS in src/lib/embeddings.ts.
create extension if not exists vector with schema extensions;

create table if not exists public.hr_chunks (
  id bigint generated always as identity primary key,
  doc_code text not null,
  doc_title text not null,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1024) not null
);

create index if not exists hr_chunks_embedding_idx
  on public.hr_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- The HR docs are already public via their share links, so reads are open. There are
-- no write policies: only the service-role key (which bypasses RLS) can change rows.
alter table public.hr_chunks enable row level security;

drop policy if exists "HR chunks are readable" on public.hr_chunks;
create policy "HR chunks are readable" on public.hr_chunks
  for select to anon, authenticated using (true);

-- Closest chunks to a query vector, best first, dropping anything under min_similarity
-- (cosine similarity: 1 is identical, near 0 is unrelated).
create or replace function public.match_hr_chunks(
  query_embedding extensions.vector(1024),
  match_count int,
  min_similarity float
)
returns table (doc_code text, doc_title text, content text, similarity float)
language sql
stable
set search_path = ''
as $$
  select nearest.doc_code, nearest.doc_title, nearest.content, nearest.similarity
  from (
    select c.doc_code, c.doc_title, c.content,
           1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.hr_chunks c
    order by c.embedding operator(extensions.<=>) query_embedding
    limit match_count
  ) nearest
  where nearest.similarity >= min_similarity
  order by nearest.similarity desc;
$$;

revoke execute on function public.match_hr_chunks(extensions.vector, int, float) from public;
grant execute on function public.match_hr_chunks(extensions.vector, int, float) to anon, authenticated;
