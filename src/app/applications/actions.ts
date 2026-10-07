"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FormState } from "@/lib/types";

// Errors raised by our own database functions use the default SQLSTATE
// (P0001) and carry a message written for users. Anything else stays generic.
const USER_FACING_ERROR = "P0001";
const FOREIGN_KEY_VIOLATION = "23503";

function toMessage(error: { code?: string; message: string }) {
  if (error.code === USER_FACING_ERROR) return error.message;
  if (error.code === FOREIGN_KEY_VIOLATION) return "That job no longer exists.";
  return "Something went wrong. Please try again.";
}

export async function applyToJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-verify the user here; never trust that the page already did.
  await requireUser();

  const jobId = String(formData.get("job_id") ?? "");
  const referralCode = String(formData.get("referral_code") ?? "")
    .trim()
    .slice(0, 50);
  const values = { referral_code: referralCode };

  if (!jobId) return { error: "Missing job.", values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_to_job", {
    p_job_id: jobId,
    p_referral_code: referralCode || null,
  });

  if (error) return { error: toMessage(error), values };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/account");
  return { message: "Application submitted. Good luck, villain." };
}

export async function withdrawApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("withdraw_application", {
    p_application_id: applicationId,
  });

  if (error) return { error: toMessage(error) };

  revalidatePath("/jobs/[id]", "page");
  revalidatePath("/account");
  return { message: "Application withdrawn." };
}
