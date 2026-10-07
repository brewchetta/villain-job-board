import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import type { Profile } from "./types";

export type SessionUser = {
  id: string;
  email: string | undefined;
};

// Cheap check for UI such as the nav ("show Log in or Log out"). Verifies the
// JWT signature without a round trip when possible. Don't use this to
// authorize access to data; use requireUser() for that.
// Reads cookies, so call it behind <Suspense>.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: data.claims.email };
}

// Authoritative check: asks the Supabase Auth server. Use in protected pages
// and in every server action that reads or writes user data.
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, first_name, last_name, resume_id, phone_number, evil_nickname",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data;
}
