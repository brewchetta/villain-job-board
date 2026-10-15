"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  MAX_RESUME_BYTES,
  RESUME_BUCKET,
  RESUME_EXTENSIONS,
  RESUME_TYPES,
  isResumeExt,
  resumeExtension,
  resumePath,
  type ResumeUploadTicket,
} from "@/lib/resume";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FormState } from "@/lib/types";

const CHOOSE_FILE = "Choose a PDF or DOCX file.";

// Step 1 of an upload. The browser can't use our HttpOnly session cookies, so
// the server checks the file's name and size and hands back a one-off signed URL
// for a path it chose itself. The file then goes straight to Storage, which also
// enforces the bucket's size and type limits.
export async function requestResumeUpload(file: {
  name: string;
  size: number;
}): Promise<ResumeUploadTicket> {
  const user = await requireUser();

  const ext = resumeExtension(String(file?.name ?? ""));
  if (!ext) return { error: CHOOSE_FILE };
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { error: "That file is empty." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: `Resumes must be ${MAX_RESUME_BYTES / 1024 / 1024} MB or smaller.` };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUploadUrl(resumePath(user.id, ext), { upsert: true });

  if (error || !data) {
    console.error("resume.signed-upload failed", { name: error?.name });
    return { error: "Could not start the upload. Please try again." };
  }

  return { uploadUrl: data.signedUrl, ext };
}

// Step 2, after the browser has uploaded. Never trusts the browser's word that
// the upload happened: it looks the object up in the user's own folder and
// re-checks its size and type before pointing the profile at it.
export async function saveResume(ext: string): Promise<FormState> {
  const user = await requireUser();
  if (!isResumeExt(ext)) return { error: CHOOSE_FILE };

  const path = resumePath(user.id, ext);
  const supabase = await createSupabaseServerClient();
  const storage = supabase.storage.from(RESUME_BUCKET);

  const { data: files, error: listError } = await storage.list(user.id);
  if (listError) {
    console.error("resume.list failed", { name: listError.name });
    return { error: "Could not check your upload. Please try again." };
  }

  const uploaded = files?.find((file) => file.name === `resume.${ext}`);
  if (!uploaded?.id) {
    return { error: "We couldn't find your upload. Please try again." };
  }

  const { size, mimetype } = uploaded.metadata ?? {};
  if (
    typeof size !== "number" ||
    size > MAX_RESUME_BYTES ||
    mimetype !== RESUME_TYPES[ext]
  ) {
    await storage.remove([path]);
    return { error: "That file isn't a valid PDF or DOCX under 5 MB." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ resume_id: uploaded.id, resume_path: path })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    console.error("resume.save failed", { code: error?.code });
    return { error: "Could not save your resume. Please try again." };
  }

  // The other format may still be there from an earlier upload.
  const stale = RESUME_EXTENSIONS.filter((other) => other !== ext).map((other) =>
    resumePath(user.id, other),
  );
  const { error: removeError } = await storage.remove(stale);
  if (removeError) console.error("resume.cleanup failed", { name: removeError.name });

  revalidatePath("/account");
  return { message: "Resume uploaded." };
}

export async function removeResume(): Promise<FormState> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error: removeError } = await supabase.storage
    .from(RESUME_BUCKET)
    .remove(RESUME_EXTENSIONS.map((ext) => resumePath(user.id, ext)));
  if (removeError) {
    console.error("resume.remove failed", { name: removeError.name });
    return { error: "Could not remove your resume. Please try again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ resume_id: null, resume_path: null })
    .eq("id", user.id);
  if (error) {
    console.error("resume.clear failed", { code: error.code });
    return { error: "Could not remove your resume. Please try again." };
  }

  revalidatePath("/account");
  return { message: "Resume removed." };
}
