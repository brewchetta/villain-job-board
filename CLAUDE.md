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
npm test         # unit tests (Vitest, single run); `npm run test:watch` to watch
```

Unit tests live beside the code as `*.test.ts` (config in `vitest.config.mts`, Node environment). They cover `src/lib`, the server actions and `src/proxy.ts` with `next/*` and Supabase mocked; shared helpers are in `src/test/` (`server-only` stub, `createQueryBuilder` for chainable Supabase queries). Async Server Components can't run under Vitest, so pages and components are not unit tested. `@types/node` is on `^22` because Vitest 5's peer range excludes `^20`.

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
- Server actions live in `src/app/auth/actions.ts` (`signUp`, `logIn`, `logOut`, `updateProfile`) with client forms in `src/app/auth/forms.tsx` using `useActionState`. Routes: `/signup`, `/login`, `/account`. User-facing auth errors are our own wording, never Supabase's `error.message`: `signUp` maps error codes to fixed text and answers an already-registered email exactly like a fresh sign-up (keep "Confirm email" on in the Supabase dashboard), `updateProfile` returns a generic message, and the real code/status is logged with `console.error`. `logOut` clears the `sb-*-auth-token` cookies itself if `signOut()` fails. Passwords are 8 to 72 bytes (bcrypt ignores the rest).
- `profiles` table (see `supabase/schema.sql`): one row per auth user, created by a trigger on sign-up from user metadata. `role` is `candidate` or `admin` and is never read from user-supplied metadata; column-level grants stop users updating `role`. `resume_id` is reserved for the Supabase Storage resume upload (not built yet) and has no foreign key. Make an admin by running an `update public.profiles set role = 'admin' ...` in the SQL editor.
- `src/lib/supabase-config.ts` holds the shared Supabase settings: `getSupabaseOrigin()` (strips paths, rejects non-https URLs except localhost) and `SUPABASE_COOKIE_OPTIONS` (HttpOnly, `Secure` in production, 7-day rolling maxAge), passed to both cookie-based clients (`supabase-server.ts` and `proxy.ts`). Because the cookies are HttpOnly, a browser-side Supabase client could not read them; revisit the options before adding one. It has no `server-only` import because `proxy.ts` uses it.
- Security headers (CSP anti-framing/base/form directives, `X-Frame-Options`, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production) are set in `next.config.ts`, which also turns off `X-Powered-By`. There is deliberately no `script-src`: a nonce CSP conflicts with Cache Components, and a no-nonce one needs `'unsafe-inline'`.
- `createSupabaseServerClient()` calls `await connection()` before reading cookies. Don't remove it: without it the dev server reports `Date.now()` "blocking-prerender-current-time" errors from the session code.
- **Applications:** `applications` table (see `supabase/schema.sql`), one row per (job, user), with `status`, optional `referral_code` (an employee id; `apply_to_job` rejects a non-blank code that isn't in the `employees` table, which has no policies or grants so candidates can't list ids, and no foreign key from `applications`; the sample employee rows in `supabase/schema.sql` are placeholders) and a `resume_id` copied from the profile at apply time. Candidates cannot write the table directly: they call the `apply_to_job` / `withdraw_application` Postgres functions via `supabase.rpc(...)` (this also handles re-applying after a withdrawal). Only admins can update `status`. Server actions are in `src/app/applications/actions.ts`; reads are in `src/lib/applications.ts` and **must filter by `user_id` explicitly**, because admins can read all rows via RLS. The job page keeps the cached job content and streams `ApplySection` (session-dependent) behind `<Suspense>`; `/account` lists "My applications" with a withdraw button.
- Do not create accounts or enter passwords through the live app when testing: sign-up goes to the remote Supabase project, so the user tests the signup/login flow themselves.
- **Weather:** the front page shows current weather for five hardcoded cities via `src/lib/weather.ts` (`getWeather()`, the only access point), rendered by `src/app/weather.tsx`. Uses WeatherAPI.com with the server-only `WEATHER_API_KEY` env var. Cities are looked up by lat/lon (not name, to avoid e.g. Naples, Italy); `'use cache'` with `cacheLife("minutes")` and `cacheTag("weather")`. A failed city (or missing key) renders "Unavailable" instead of breaking the page. Never put the request URL in errors; it contains the key.
- **Email:** sent through Resend, only via `sendEmail()` in `src/lib/email/client.ts` (server-only env vars `RESEND_API_KEY`, optional `EMAIL_FROM`). It never throws: a missing key or provider error is logged by error name only (never the recipient) and returns `{ ok: false }`. Content lives in `src/lib/email/templates.ts` as pure functions returning `{ subject, text, html? }`; emails are plain text for now, and styling later means adding `html` per template. `applyToJob` sends the "you're hired" email inside `after()` (so it never delays or fails the form), looking up the job title and the greeting name (`evil_nickname`, then first name, then display name, then "Henchman") itself. It fires on every successful apply, including a re-apply after withdrawal. Without a verified domain, the default sandbox sender only delivers to the Resend account owner's address. Any test that runs the real `applyToJob` must mock `next/server` (`after`), `@/lib/jobs`, `@/lib/email/client` and `getProfile` from `@/lib/auth` (see `apply-flow.test.tsx`).
- Routes (server components): `/` (mission statement, core beliefs, weather), `/jobs` (list, 10 per page via `?page=N`, with an empty state; it reads `searchParams`, so `src/app/jobs/loading.tsx` supplies the Suspense boundary), `/jobs/[id]` (show page). The show page uses `generateStaticParams` over `getJobs()` so the build can prerender it, and calls `notFound()` for unknown ids. Unknown ids are rendered at request time, so they return the 404 UI with HTTP 200 (documented streaming behavior).
- `src/app/layout.tsx` holds the site-wide metadata, fonts, and the nav (logo from `public/logo.png`, Home / Jobs links).

## Future features (not started)

- **Candidate matching:** match a candidate to jobs based on things like qualifications. Note that `Job.qualifications` is currently free-text `string[]`, which may need structuring to support matching.
- **Resume uploads:** the user plans to use Supabase Storage; `profiles.resume_id` is the placeholder column. Still to do: a bucket, per-user Storage access policies, and an upload UI on `/account`. Downloads use the object's path, not its id, so a path column may be needed.
- **Admin features:** a Row Level Security write policy on `jobs` for admins (`public.is_admin()` already exists), then an admin form to post jobs, replacing SQL-editor inserts.
- **Admin application review:** a page for admins to see applicants per job and move applications through statuses (RLS already allows it); possibly a separate admin-only notes table.
- **Monthly newsletter ("what does evil mean to you?"):** a cron job emailing everyone on the job board, reusing `sendEmail()` plus a new template in `src/lib/email/templates.ts`. Still to do:
  - Subscriber list: emails live only in `auth.users` (not `profiles`) and no service-role key or client exists. Add a server-only admin client (`SUPABASE_SERVICE_ROLE_KEY`) or a `SECURITY DEFINER` function that returns subscriber emails; only include users with `email_confirmed_at`.
  - Opt-out: add `profiles.newsletter_opt_in` (with a column-level update grant like the other editable fields) and an unsubscribe link in every send.
  - Cron: `vercel.json` `crons` entry hitting a new `route.ts`, guarded by `CRON_SECRET` (`Authorization: Bearer`). `src/proxy.ts` runs on all non-static paths, so check it passes the route through.
  - Fan-out: batch sends (Resend `batch.send`) with rate limits in mind, and make a retry unable to double-send.
- **Open/closed jobs:** an `is_open` flag on `jobs` so applications to filled positions are blocked (changes the `Job` type, so ask first).
