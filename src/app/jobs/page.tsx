import Link from "next/link";
import { getJobs } from "@/lib/jobs";

export const metadata = {
  title: "Open Positions | The Garden",
};

const PAGE_SIZE = 10;

// Only a plain positive whole number counts; anything else (abc, 0, -3, 1.5, a
// repeated ?page=) is treated as the first page.
function parsePage(value: string | string[] | undefined) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
}

function pageHref(page: number) {
  return page === 1 ? "/jobs" : `/jobs?page=${page}`;
}

// Reads searchParams, so this route streams in behind the Suspense boundary that
// loading.tsx provides. The cached job data itself comes from getJobs().
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [jobs, { page: requestedPage }] = await Promise.all([getJobs(), searchParams]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  // A page number past the end shows the last page instead of a blank one.
  const page = Math.min(parsePage(requestedPage), totalPages);
  const visibleJobs = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main>
      <h1>Open Positions</h1>

      {jobs.length === 0 ? (
        <p>
          There are no open positions right now. Check back soon, or{" "}
          <Link href="/">return home</Link>.
        </p>
      ) : (
        <>
          <ul className="card-list">
            {visibleJobs.map((job) => (
              <li key={job.id}>
                <h2>
                  <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                </h2>
                <p>{job.summary}</p>
              </li>
            ))}
          </ul>

          <nav aria-label="Pagination" className="pagination">
            {page > 1 ? <Link href={pageHref(page - 1)}>&larr; Previous</Link> : null}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? <Link href={pageHref(page + 1)}>Next &rarr;</Link> : null}
          </nav>
        </>
      )}
    </main>
  );
}
