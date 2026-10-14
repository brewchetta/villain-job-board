"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getProfile, requireUser, type SessionUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/client";
import { greetingName, hiredEmail } from "@/lib/email/templates";
import { getJobById } from "@/lib/jobs";
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

// Henchmen are hired on the spot, so every successful application gets a
// "you're hired" email. Runs after the response is sent and swallows every
// failure: a missing email must never turn a saved application into an error.
async function sendHiredEmail(user: SessionUser, jobId: string) {
  if (!user.email) return;
  try {
    const [job, profile] = await Promise.all([
      getJobById(jobId),
      getProfile(user.id),
    ]);
    if (!job) return;
    await sendEmail({
      to: user.email,
      ...hiredEmail({ name: greetingName(profile), jobTitle: job.title }),
    });
  } catch (error) {
    console.error(
      "Hired email failed:",
      error instanceof Error ? error.name : "unknown error",
    );
  }
}

export async function applyToJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-verify the user here; never trust that the page already did.
  const user = await requireUser();

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

  after(() => sendHiredEmail(user, jobId));
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
