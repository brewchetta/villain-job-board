import Link from "next/link";
import { Suspense } from "react";
import { getProfile, requireUser } from "@/lib/auth";
import { getMyApplications } from "@/lib/applications";
import { ProfileForm } from "../auth/forms";
import { WithdrawButton } from "../applications/forms";

export const metadata = {
  title: "Your account | The Garden",
};

export default function AccountPage() {
  return (
    <main>
      <h1>Your account</h1>
      {/* Reads the session cookie, so it must sit behind a Suspense boundary. */}
      <Suspense fallback={<p>Loading your account...</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

async function AccountContent() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!profile) {
    return (
      <p>
        We couldn&apos;t find a profile for your account. Contact an
        administrator.
      </p>
    );
  }

  return (
    <>
      <dl className="details">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>{profile.role}</dd>
      </dl>
      <h2>Profile</h2>
      <ProfileForm profile={profile} />
      <h2>My applications</h2>
      <Applications userId={user.id} />
    </>
  );
}

const WITHDRAWABLE = ["submitted", "reviewing", "interviewing", "offered"];

async function Applications({ userId }: { userId: string }) {
  const applications = await getMyApplications(userId);

  if (applications.length === 0) {
    return (
      <p>
        You haven&apos;t applied for anything yet.{" "}
        <Link href="/jobs">Browse open positions</Link>
      </p>
    );
  }

  return (
    <ul className="card-list">
      {applications.map((application) => (
        <li key={application.id}>
          <h3>
            <Link href={`/jobs/${application.job_id}`}>
              {application.job_title}
            </Link>
          </h3>
          <p>
            Status: <strong className="status">{application.status}</strong>
            {" · "}
            Applied {new Date(application.created_at).toLocaleDateString("en-US")}
            {application.referral_code
              ? ` · Referral code: ${application.referral_code}`
              : ""}
          </p>
          {WITHDRAWABLE.includes(application.status) ? (
            <WithdrawButton applicationId={application.id} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
