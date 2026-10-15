"use client";

import { useState } from "react";
import type { ResumeExt } from "@/lib/resume";
import { RemoveResumeButton, ResumeUploadForm } from "./forms";
import { ResumePreview } from "./resume-preview";

// Ties the preview to the upload form: replacing a PDF with another PDF keeps
// the same path and ext, so the form has to tell the preview to fetch again.
export function ResumeSection({ ext }: { ext: ResumeExt | null }) {
  const [version, setVersion] = useState(0);

  return (
    <>
      {ext ? (
        <>
          <ResumePreview ext={ext} version={version} />
          <div className="resume-actions">
            {/* A route handler that redirects to a signed link, so a plain <a>. */}
            <a href="/account/resume">Download your current resume</a>
            {" · "}
            <RemoveResumeButton />
          </div>
        </>
      ) : (
        <p>No resume on file yet.</p>
      )}
      <ResumeUploadForm
        hasResume={ext !== null}
        onUploaded={() => setVersion((current) => current + 1)}
      />
    </>
  );
}
