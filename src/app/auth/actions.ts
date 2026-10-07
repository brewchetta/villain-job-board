"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FormState } from "@/lib/types";

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
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", values };
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

  if (error) return { error: error.message, values };

  // No session means the project requires email confirmation first.
  if (!data.session) {
    return {
      message: "Almost there. Check your email to confirm your account, then log in.",
    };
  }

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

export async function logOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
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

  if (error) return { error: error.message, values };
  if (!data?.length) {
    return {
      error: "No profile found for your account. Contact an administrator.",
      values,
    };
  }

  return { message: "Profile saved.", values };
}
