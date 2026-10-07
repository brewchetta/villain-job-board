import Link from "next/link";
import { logOut } from "./auth/actions";
import { getSessionUser } from "@/lib/auth";

// Reads the session cookie, so render it inside <Suspense>.
export async function UserNav() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <Link href="/login">Log in</Link>
        <Link href="/signup">Sign up</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/account">Account</Link>
      <form action={logOut}>
        <button type="submit" className="link-button">
          Log out
        </button>
      </form>
    </>
  );
}
