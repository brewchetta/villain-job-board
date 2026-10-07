import { cacheLife, cacheTag } from "next/cache";
import { createSupabaseClient } from "./supabase";
import type { Job } from "./types";

// The jobs table is defined in supabase/schema.sql and its columns match the
// Job type exactly. Keep getJobs/getJobById as the only access points.
export async function getJobs(): Promise<Job[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("jobs");

  const { data, error } = await createSupabaseClient()
    .from("jobs")
    .select("id, title, summary, pay, benefits, qualifications, location, disclaimers")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return data;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("jobs", `job:${id}`);

  const { data, error } = await createSupabaseClient()
    .from("jobs")
    .select("id, title, summary, pay, benefits, qualifications, location, disclaimers")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load job: ${error.message}`);
  return data ?? undefined;
}
