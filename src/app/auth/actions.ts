"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FormState } from "@/lib/types";

// Shown after sign-up whether the email is new, already registered, or the
// project requires confirmation. One message for all three, so the form can't
// be used to discover which emails have accounts.
const CHECK_EMAIL_MESSAGE =
  "Almost there. If that email can be registered, check your inbox to confirm your account, then log in.";

// bcrypt (used by Supabase Auth) only reads the first 72 bytes of a password.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

// Supabase Auth error text is written for developers and can reveal project
// settings or existing accounts, so only our own wording reaches the user.
function signUpErrorMessage(code: string | undefined) {
  switch (code) {
    case "weak_password":
      return "That password is too weak. Try a longer or less common one.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return "We couldn't create your account. Please try again.";
  }
}

const PROFILE_FIELDS = [
  "display_name",
  "first_name",
  "last_name",
  "phone_number",
  "evil_nickname",
] as const;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim().slice(0, 200);
}

function profileValues(formData: FormData) {
  return Object.fromEntries(
    PROFILE_FIELDS.map((name) => [name, field(formData, name)]),
  );
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const profile = profileValues(formData);
  const values = { email, ...profile };

  if (!email.includes("@")) {
    return { error: "Enter a valid email address.", values };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, values };
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return { error: `Password must be ${MAX_PASSWORD_BYTES} characters or fewer.`, values };
  }

  // Non-empty profile fields ride along as user metadata; a database trigger
  // copies them into the profiles table. Role is never taken from here.
  const metadata = Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== ""),
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    // With "Confirm email" off, Supabase reports duplicates as an error;
    // answer exactly as for a fresh sign-up.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { message: CHECK_EMAIL_MESSAGE };
    }
    // Only the code and status are logged: no message text, no email.
    console.error("auth.signup failed", { code: error.code, status: error.status });
    return { error: signUpErrorMessage(error.code), values };
  }

  // No session means the project requires email confirmation first.
  if (!data.session) return { message: CHECK_EMAIL_MESSAGE };

  redirect("/account");
}

export async function logIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately vague so the form can't be used to discover which emails exist.
  if (error) return { error: "Invalid email or password.", values: { email } };

  redirect("/account");
}

// Supabase's auth cookies: sb-<project>-auth-token, plus .0, .1 ... chunks.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export async function logOut() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    // signOut can fail before it clears the local session (for example when
    // loading it hits a network error), which would leave someone signed in on
    // a shared machine. Clear the cookies ourselves; the failed server-side
    // revoke is logged.
    console.error("auth.logout failed", { code: error.code, status: error.status });
    const cookieStore = await cookies();
    for (const { name } of cookieStore.getAll()) {
      if (AUTH_COOKIE.test(name)) cookieStore.delete(name);
    }
  }

  redirect("/");
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-verify the user here; never trust that the page already did.
  const user = await requireUser();
  const values = profileValues(formData);

  // Row Level Security plus column grants mean this can only touch the
  // caller's own row and only these columns (never role).
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value || null]),
      ),
    )
    .eq("id", user.id)
    .select("id");

  if (error) {
    // Raw database messages can expose table, column and policy names.
    console.error("profile.update failed", { code: error.code, message: error.message });
    return { error: "Could not save your profile. Please try again.", values };
  }
  if (!data?.length) {
    return {
      error: "No profile found for your account. Contact an administrator.",
      values,
    };
  }

  return { message: "Profile saved.", values };
}
