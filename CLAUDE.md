# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Job board for "The Garden", a fictional super villain organization. Next.js (App Router, TypeScript, `src/` dir) with Supabase planned as the database. Supabase is **not connected yet**: all job data is mocked. Styling is intentionally deferred, so pages use plain unstyled markup and there is no Tailwind.

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

- `src/lib/jobs.ts` is the only data access point: async `getJobs()` and `getJobById(id)` over an in-memory mock array. Pages must go through these, so the later Supabase swap only touches this file (and `src/lib/types.ts`).
- `src/lib/types.ts` holds the `Job` type: `id`, `title`, `summary`, `pay` (string), `location` (string), and `benefits`, `qualifications`, `disclaimers` (all `string[]`). The field set was specified by the user; ask before adding or changing fields. Types are display-oriented and should be revisited when designing the Supabase schema.
- Routes (server components): `/` (mission statement and core beliefs), `/jobs` (list), `/jobs/[id]` (show page). The show page uses `generateStaticParams` over `getJobs()` so the build can prerender it, and calls `notFound()` for unknown ids. Unknown ids are rendered at request time, so they return the 404 UI with HTTP 200 (documented streaming behavior).
- `src/app/layout.tsx` holds the site-wide metadata and the minimal Home / Jobs nav.

Planned next steps, in order: connect Supabase, then style.

## Future features (not started)

- **Candidate matching:** match a candidate to jobs based on things like qualifications. Note that `Job.qualifications` is currently free-text `string[]`, which may need structuring to support matching.
- **Resume uploads:** a service for uploading resumes still needs to be chosen. Supabase Storage is one option since Supabase is already planned; discuss with the user before picking.
