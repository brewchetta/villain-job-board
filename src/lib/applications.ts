import "server-only";
import { createSupabaseServerClient } from "./supabase-server";
import type { Application, ApplicationStatus } from "./types";

// Both reads filter on user_id explicitly. RLS also lets admins read every
// application, so relying on RLS alone would return other people's rows for
// an admin.

export async function getMyApplicationForJob(
  userId: string,
  jobId: string,
): Promise<{ id: string; status: ApplicationStatus } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, status")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load application: ${error.message}`);
  return data;
}

export async function getMyApplications(userId: string): Promise<Application[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, job_id, status, referral_code, created_at, jobs(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load applications: ${error.message}`);

  return (data ?? []).map((row) => {
    // The embedded relation comes back as an object (or a one-item array).
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    return {
      id: row.id,
      job_id: row.job_id,
      job_title: job?.title ?? row.job_id,
      status: row.status,
      referral_code: row.referral_code,
      created_at: row.created_at,
    };
  });
}
