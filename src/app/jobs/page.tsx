import Link from "next/link";
import { getJobs } from "@/lib/jobs";

export const metadata = {
  title: "Open Positions | The Garden",
};

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <main>
      <h1>Open Positions</h1>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <h2>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            </h2>
            <p>{job.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
