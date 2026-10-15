import { NextResponse } from "next/server";
import { getProfile, requireUser } from "@/lib/auth";
import { RESUME_BUCKET, resumeExtension } from "@/lib/resume";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const LINK_LIFETIME_SECONDS = 60;

// Downloads the signed-in user's own resume. The bucket is private, so this
// hands out a short-lived signed link instead of a public URL.
export async function GET() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const path = profile?.resume_path;
  const ext = path ? resumeExtension(path) : null;

  // profiles.resume_path is user-editable, so only serve paths in their own folder.
  if (!path || !ext || !path.startsWith(`${user.id}/`)) {
    return new NextResponse("No resume on file.", { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, LINK_LIFETIME_SECONDS, { download: `resume.${ext}` });

  if (error || !data) {
    console.error("resume.signed-url failed", { name: error?.name });
    return new NextResponse("Could not load your resume.", { status: 404 });
  }

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
