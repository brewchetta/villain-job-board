"use client";

import { useActionState, useState, type FormEvent } from "react";
import { RESUME_TYPES, MAX_RESUME_BYTES } from "@/lib/resume";
import type { FormState } from "@/lib/types";
import { removeResume, requestResumeUpload, saveResume } from "./actions";

const initialState: FormState = {};
const UPLOAD_FAILED =
  "The upload failed. Check that it's a PDF or DOCX under 5 MB and try again.";

async function uploadResume(file: File): Promise<FormState> {
  const ticket = await requestResumeUpload({ name: file.name, size: file.size });
  if ("error" in ticket) return { error: ticket.error };

  // Same request shape the Supabase SDK sends for a signed upload. Some
  // browsers report no type for .docx, and the bucket checks it, so set it from
  // the extension the server already validated.
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", new Blob([file], { type: RESUME_TYPES[ticket.ext] }));

  try {
    const response = await fetch(ticket.uploadUrl, {
      method: "PUT",
      body,
      headers: { "x-upsert": "true" },
    });
    if (!response.ok) return { error: UPLOAD_FAILED };
  } catch {
    return { error: UPLOAD_FAILED };
  }

  return saveResume(ticket.ext);
}

export function ResumeUploadForm({
  hasResume,
  onUploaded,
}: {
  hasResume: boolean;
  onUploaded?: () => void;
}) {
  const [state, setState] = useState<FormState>(initialState);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("resume");

    if (!(file instanceof File) || file.size === 0) {
      setState({ error: "Choose a PDF or DOCX file." });
      return;
    }

    setPending(true);
    setState(initialState);
    try {
      const result = await uploadResume(file);
      setState(result);
      if (result.message) {
        form.reset();
        onUploaded?.();
      }
    } catch {
      setState({ error: UPLOAD_FAILED });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      {state.error ? <p role="alert" className="form-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="form-message">{state.message}</p> : null}
      <label className="field">
        <span>{hasResume ? "Replace your resume" : "Upload your resume"}</span>
        <input name="resume" type="file" accept=".pdf,.docx" required />
        <small>PDF or DOCX, up to {MAX_RESUME_BYTES / 1024 / 1024} MB.</small>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Uploading..." : hasResume ? "Replace resume" : "Upload resume"}
      </button>
    </form>
  );
}

export function RemoveResumeButton() {
  const [state, action, pending] = useActionState(removeResume, initialState);

  return (
    <form action={action} className="inline-form">
      <button type="submit" disabled={pending} className="link-button">
        {pending ? "Removing..." : "Remove resume"}
      </button>
      {state.error ? (
        <span role="alert" className="form-error-inline">{state.error}</span>
      ) : null}
    </form>
  );
}
