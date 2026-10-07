import Link from "next/link";
import { LogInForm } from "../auth/forms";

export const metadata = {
  title: "Log in | The Garden",
};

export default function LoginPage() {
  return (
    <main>
      <h1>Log in</h1>
      <LogInForm />
      <p>
        New here? <Link href="/signup">Join The Garden</Link>
      </p>
    </main>
  );
}
