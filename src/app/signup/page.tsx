import Link from "next/link";
import { SignUpForm } from "../auth/forms";

export const metadata = {
  title: "Join The Garden",
};

export default function SignUpPage() {
  return (
    <main>
      <h1>Join The Garden</h1>
      <SignUpForm />
      <p>
        Already one of us? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
