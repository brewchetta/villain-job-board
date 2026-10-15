"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ResumeExt } from "@/lib/resume";

// pdf.js and docx-preview need browser APIs, and are large, so they load only
// on the client and only for someone who actually has a resume.
const Loading = () => <p className="resume-status">Loading preview...</p>;
const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false, loading: Loading });
const DocxViewer = dynamic(() => import("./docx-viewer"), { ssr: false, loading: Loading });

// file is for docx-preview; url (a blob URL for the same bytes) is for pdf.js.
type Fetched = { key: string; resume: { file: Blob; url: string } | null };

export function ResumePreview({ ext, version }: { ext: ResumeExt; version: number }) {
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Changing the file type, or uploading again, changes the key and so refetches.
  const key = `${ext}:${version}`;

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;

    // The route checks the session and redirects to a fresh signed link, so the
    // bytes are fetched once here and shared by the thumbnail and the modal.
    fetch("/account/resume", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("resume fetch failed");
        return response.blob();
      })
      .then((file) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(file);
        setFetched({ key, resume: { file, url } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ key, resume: null });
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  // Until the fetch for the current key finishes, show loading, not stale bytes.
  const current = fetched?.key === key ? fetched : null;

  if (!current) return <p className="resume-status" role="status">Loading preview...</p>;
  if (!current.resume) {
    return (
      <p role="alert" className="resume-status">
        We couldn&apos;t load a preview of your resume. You can still download it.
      </p>
    );
  }

  const { file, url } = current.resume;
  const viewer = (mode: "thumb" | "full") =>
    ext === "pdf" ? <PdfViewer url={url} mode={mode} /> : <DocxViewer file={file} mode={mode} />;

  return (
    <>
      <button
        type="button"
        className="resume-thumb"
        aria-label="Enlarge resume preview"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        {viewer("thumb")}
        <span className="resume-thumb-hint" aria-hidden="true">Click to enlarge</span>
      </button>

      {/* Esc and close() both fire onClose. A click on the backdrop lands on the
          dialog element itself, because the dialog has no padding. */}
      <dialog
        ref={dialogRef}
        className="resume-modal"
        aria-label="Resume preview"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        {open ? (
          <>
            <div className="resume-modal-header">
              <strong>Your resume</strong>
              <span>
                {/* A route handler that redirects to a signed link, so a plain <a>. */}
                <a href="/account/resume">Download</a>
                {" · "}
                <button type="button" className="link-button" onClick={() => dialogRef.current?.close()}>
                  Close
                </button>
              </span>
            </div>
            <div className="resume-modal-body">{viewer("full")}</div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
