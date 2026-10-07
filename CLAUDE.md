# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Job board for "The Garden", a fictional super villain organization. Next.js (App Router, TypeScript, `src/` dir) with Supabase as the database. Jobs are read from the `jobs` table; the schema and seed data live in `supabase/schema.sql` and must be run manually in the Supabase SQL editor (no migration tooling yet).

Env vars (server-only, no `NEXT_PUBLIC_` prefix): `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, set in `.env.local` (see `.env.example`). Do not read `.env*` files. Styling is plain CSS in `src/app/globals.css` (no Tailwind): a Grinch-style theme of dark green background, Grinch-green headings, and dark red nav/accents with cream trim. Colors are CSS variables in `:root`; headings use the "Creepster" font (single weight, keep `font-weight: 400`) via `next/font` (`--font-display`). Shared class hooks: `.site-nav*`, `.card-list`, `a.button`.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build; also type-checks and prerenders, so it catches Cache Components errors
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured.

The folder name `NodeJsFirstBuild` contains capitals, which npm rejects as a package name. The package is named `the-garden`, so don't re-run `create-next-app` in place.

## Next.js version caveat

This is Next 16.x with breaking changes from older versions (see `AGENTS.md`). Read the bundled docs in `node_modules/next/dist/docs/` before writing Next-specific code rather than relying on memory. In particular:

- `next.config.ts` enables `cacheComponents` and `partialPrefetching`. Under Cache Components, reading `params` (or other runtime data) outside `<Suspense>` fails `next build` with a "blocking prerender" error.
- `params` is a Promise: `const { id } = await params`.
- `LayoutProps<"/">` is a globally available generated type used by the root layout.

## Architecture

- `src/lib/jobs.ts` is the only data access point: async `getJobs()` and `getJobById(id)`, querying Supabase through `createSupabaseClient()` in `src/lib/supabase.ts`. Both are wrapped in `'use cache'` with `cacheLife("minutes")` and `cacheTag("jobs")` (plus `job:<id>`), which Cache Components requires since the Supabase client uses `fetch`. Use `revalidateTag("jobs")` after any future write. Table columns match the `Job` type exactly, so there is no mapping layer; if you change `Job`, update `supabase/schema.sql` and the `select(...)` lists too.
- `src/lib/types.ts` holds the `Job` type: `id`, `title`, `summary`, `pay` (string), `location` (string), and `benefits`, `qualifications`, `disclaimers` (all `string[]`). The field set was specified by the user; ask before adding or changing fields. It also holds `Profile` (mirrors the `profiles` table) and `FormState` (shared result shape for form server actions).
- **Auth (Supabase Auth, email + password, candidates first):** two Supabase clients exist on purpose. `src/lib/supabase.ts` is cookie-less and used for public, cached data (jobs). `src/lib/supabase-server.ts` is per-request and cookie-based, used for anything user-specific; create a new one per request. Reading cookies makes a route dynamic, so any component that reads the session must sit behind `<Suspense>` (see the nav in `layout.tsx` via `src/app/user-nav.tsx`, and `/account`).
- `src/proxy.ts` (Next 16's replacement for middleware) only refreshes the session cookies via `getClaims()`; it does not protect routes. Authorization happens in code: `requireUser()` in `src/lib/auth.ts` (calls `getUser()`, redirects to `/login`) for pages, and again inside every server action. `getSessionUser()` is a cheap check for UI only, never for authorizing data access.
- Server actions live in `src/app/auth/actions.ts` (`signUp`, `logIn`, `logOut`, `updateProfile`) with client forms in `src/app/auth/forms.tsx` using `useActionState`. Routes: `/signup`, `/login`, `/account`.
- `profiles` table (see `supabase/schema.sql`): one row per auth user, created by a trigger on sign-up from user metadata. `role` is `candidate` or `admin` and is never read from user-supplied metadata; column-level grants stop users updating `role`. `resume_id` is reserved for the Supabase Storage resume upload (not built yet) and has no foreign key. Make an admin by running an `update public.profiles set role = 'admin' ...` in the SQL editor.
- `createSupabaseServerClient()` calls `await connection()` before reading cookies. Don't remove it: without it the dev server reports `Date.now()` "blocking-prerender-current-time" errors from the session code.
- **Applications:** `applications` table (see `supabase/schema.sql`), one row per (job, user), with `status`, optional free-text `referral_code` (an employee id; no employees table to validate against yet) and a `resume_id` copied from the profile at apply time. Candidates cannot write the table directly: they call the `apply_to_job` / `withdraw_application` Postgres functions via `supabase.rpc(...)` (this also handles re-applying after a withdrawal). Only admins can update `status`. Server actions are in `src/app/applications/actions.ts`; reads are in `src/lib/applications.ts` and **must filter by `user_id` explicitly**, because admins can read all rows via RLS. The job page keeps the cached job content and streams `ApplySection` (session-dependent) behind `<Suspense>`; `/account` lists "My applications" with a withdraw button.
- Do not create accounts or enter passwords through the live app when testing: sign-up goes to the remote Supabase project, so the user tests the signup/login flow themselves.
- Routes (server components): `/` (mission statement and core beliefs), `/jobs` (list), `/jobs/[id]` (show page). The show page uses `generateStaticParams` over `getJobs()` so the build can prerender it, and calls `notFound()` for unknown ids. Unknown ids are rendered at request time, so they return the 404 UI with HTTP 200 (documented streaming behavior).
- `src/app/layout.tsx` holds the site-wide metadata, fonts, and the nav (logo from `public/logo.png`, Home / Jobs links).

## Future features (not started)

- **Candidate matching:** match a candidate to jobs based on things like qualifications. Note that `Job.qualifications` is currently free-text `string[]`, which may need structuring to support matching.
- **Resume uploads:** the user plans to use Supabase Storage; `profiles.resume_id` is the placeholder column. Still to do: a bucket, per-user Storage access policies, and an upload UI on `/account`. Downloads use the object's path, not its id, so a path column may be needed.
- **Admin features:** a Row Level Security write policy on `jobs` for admins (`public.is_admin()` already exists), then an admin form to post jobs, replacing SQL-editor inserts.
- **Admin application review:** a page for admins to see applicants per job and move applications through statuses (RLS already allows it); possibly a separate admin-only notes table.
- **Open/closed jobs:** an `is_open` flag on `jobs` so applications to filled positions are blocked (changes the `Job` type, so ask first).
