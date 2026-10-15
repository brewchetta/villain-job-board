// Shared by the resume server actions, the download route and the upload form,
// so it must not import "server-only".

export const RESUME_BUCKET = "resumes";

// Keep in step with file_size_limit and allowed_mime_types on the bucket in
// supabase/schema.sql.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const RESUME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

// Thumbnail box on /account (US Letter ratio). Keep in step with .resume-thumb
// in globals.css.
export const RESUME_THUMB_WIDTH = 160;
export const RESUME_THUMB_HEIGHT = 207;

export type ResumeExt = keyof typeof RESUME_TYPES;

export const RESUME_EXTENSIONS = Object.keys(RESUME_TYPES) as ResumeExt[];

// Result of asking the server for permission to upload: either an error to
// show, or a one-off URL to PUT the file to.
export type ResumeUploadTicket =
  | { error: string }
  | { uploadUrl: string; ext: ResumeExt };

export function isResumeExt(value: unknown): value is ResumeExt {
  return typeof value === "string" && Object.hasOwn(RESUME_TYPES, value);
}

export function resumeExtension(filename: string): ResumeExt | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return isResumeExt(ext) ? ext : null;
}

// The server picks the path, never the browser, so a user can only ever write
// inside their own folder.
export function resumePath(userId: string, ext: ResumeExt) {
  return `${userId}/resume.${ext}`;
}
