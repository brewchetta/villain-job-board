# The Garden

Job board for The Garden, a fictional super villain organization. Visitors can read the mission, see live weather in five cities, browse open positions, and sign up to apply. Built with [Next.js](https://nextjs.org) (App Router, TypeScript) and [Supabase](https://supabase.com) for the database and auth.

## Tech stack

- Next.js 16 (App Router, `src/` directory, Cache Components enabled)
- React 19 and TypeScript
- Supabase: Postgres tables with Row Level Security, Auth (email and password), and `@supabase/ssr` for cookie-based sessions
- WeatherAPI.com for current weather
- Plain CSS in `src/app/globals.css` (no Tailwind)

## Prerequisites

- Node.js and npm (the repo does not pin a Node version; the `@types/node` dependency is `^20`)
- A Supabase project
- A WeatherAPI.com API key (optional; without it the weather section shows "Unavailable")

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root (copy `.env.example`) and set these server-only variables. None of them use the `NEXT_PUBLIC_` prefix, so they never reach the browser.

   | Variable | Used for |
   | --- | --- |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
   | `WEATHER_API_KEY` | WeatherAPI.com key for the front page weather |

3. Create the database. In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it. The script is safe to re-run. There is no migration tooling yet, so schema changes are applied by hand.

4. (Optional) Make a user an admin by running this in the SQL Editor, replacing the UUID with the user's id:

   ```sql
   update public.profiles set role = 'admin' where id = '<user uuid>';
   ```

## Scripts

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (type-checks and prerenders)
npm run start    # serve the production build
npm run lint     # ESLint (flat config in eslint.config.mjs)
```

There is no test runner configured.

Note: `npm run build` is the best check for Cache Components mistakes, such as reading `params` or cookies outside `<Suspense>`.

## Pages

| Route | Description |
| --- | --- |
| `/` | Mission, core beliefs, and weather for five cities |
| `/jobs` | List of open positions |
| `/jobs/[id]` | Job details and the apply form (or application status) |
| `/signup` | Create an account |
| `/login` | Log in |
| `/account` | Profile form, role, and "My applications" with withdraw buttons (requires login) |

Job pages are prerendered from the database. Unknown job ids return the 404 page.

## Project structure

```
supabase/schema.sql         Tables, RLS policies, triggers, seed jobs, apply/withdraw functions
src/
  proxy.ts                  Refreshes the Supabase session cookies on each request (not an auth gate)
  app/
    layout.tsx              Site metadata, fonts, nav
    page.tsx                Home page
    weather.tsx             Weather section (rendered on the home page)
    jobs/                   Job list and job detail pages
    login/, signup/         Auth pages
    account/                Account page
    auth/actions.ts         Sign up, log in, log out, update profile (server actions)
    applications/actions.ts Apply and withdraw (server actions)
    user-nav.tsx            Login/logout links in the nav
  lib/
    jobs.ts                 The only access point for job data
    weather.ts              The only access point for weather data
    applications.ts         Reads of the current user's applications
    auth.ts                 requireUser() and getSessionUser()
    supabase.ts             Cookie-less client for public, cached data
    supabase-server.ts      Per-request, cookie-based client for user data
    types.ts                Job, Profile, Application, and FormState types
public/                     Static assets, including the logo
```

## Architecture notes

- **Two Supabase clients.** `src/lib/supabase.ts` has no cookies and serves public, cached data (jobs). `src/lib/supabase-server.ts` is created per request and carries the user's session. Create a new server client for every request; never share one.
- **Caching.** `getJobs`, `getJobById`, and `getWeather` use `"use cache"` with `cacheLife("minutes")` and cache tags (`jobs`, `job:<id>`, `weather`). Call `revalidateTag("jobs")` after any future write to the jobs table.
- **Authorization happens in code.** `src/proxy.ts` only refreshes sessions. Pages call `requireUser()`, and every server action re-checks the user. Data-access functions do not trust the page, and reads of user-specific rows filter by `user_id` explicitly, because admins can read every row through RLS.
- **Database security.** RLS is enabled on every table. Candidates cannot write `profiles` (including `role`) or `applications` directly; they use the `apply_to_job` and `withdraw_application` Postgres functions. Only admins can change an application's `status`.
- **Profile creation.** A trigger creates a `profiles` row for each new auth user, using optional name fields from sign-up metadata. Role is never read from user metadata.
- **Weather.** Cities are looked up by coordinates so names like "Naples" resolve to the intended city. A failed lookup shows "Unavailable" for that city without breaking the page. Errors never include the request URL, because it contains the API key.

## Not built yet

These are planned but do not exist in the code:

- Candidate matching against job qualifications
- Resume uploads (Supabase Storage; `profiles.resume_id` is a placeholder column)
- Admin tools for posting jobs and reviewing applications (the schema already allows status updates by admins)
- Open and closed job flags
