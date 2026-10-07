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

      <section>
        <h2>Location</h2>
        <p>{job.location}</p>
      </section>

      <section>
        <h2>Pay</h2>
        <p>{job.pay}</p>
      </section>

      <section>
        <h2>Qualifications</h2>
        <ul>
          {job.qualifications.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Benefits</h2>
        <ul>
          {job.benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Disclaimers</h2>
        <ul>
          {job.disclaimers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
