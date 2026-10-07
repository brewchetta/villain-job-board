import { Suspense } from "react";
import { getProfile, requireUser } from "@/lib/auth";
import { ProfileForm } from "../auth/forms";

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
    </>
  );
}
