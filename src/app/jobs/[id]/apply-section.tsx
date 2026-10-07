import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getMyApplicationForJob } from "@/lib/applications";
import { ApplyForm } from "../../applications/forms";

// Reads the session cookie, so render it inside <Suspense>. The rest of the
// job page stays cached and prerendered.
export async function ApplySection({ jobId }: { jobId: string }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <p>
        <Link href="/login">Log in</Link> or <Link href="/signup">join The Garden</Link>{" "}
        to apply for this position.
      </p>
    );
  }

  const application = await getMyApplicationForJob(user.id, jobId);

  if (application && application.status !== "withdrawn") {
    return (
      <p>
        You applied for this position. Status:{" "}
        <strong className="status">{application.status}</strong>.{" "}
        <Link href="/account">View your applications</Link>
      </p>
    );
  }

  return <ApplyForm jobId={jobId} />;
}
