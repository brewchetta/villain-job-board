import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobById, getJobs } from "@/lib/jobs";

export async function generateStaticParams() {
  const jobs = await getJobs();
  return jobs.map((job) => ({ id: job.id }));
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return (
    <main>
      <p>
        <Link href="/jobs">&larr; All positions</Link>
      </p>
      <h1>{job.title}</h1>
      <p>{job.summary}</p>
    </main>
  );
}
