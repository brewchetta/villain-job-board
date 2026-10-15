"use client";

import { renderAsync } from "docx-preview";
import { useEffect, useRef, useState } from "react";
import { sanitizeLinks } from "@/lib/docx-links";
import { RESUME_THUMB_WIDTH } from "@/lib/resume";

export default function DocxViewer({
  file,
  mode,
}: {
  file: Blob;
  mode: "thumb" | "full";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"rendering" | "ready" | "error">("rendering");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Each run renders into its own holder, so a render that finishes after a
    // re-run or unmount can only write into a holder that has been removed.
    const holder = document.createElement("div");
    host.append(holder);
    let cancelled = false;

    renderAsync(file, holder, holder, {
      // Embedded HTML parts are the riskiest thing a .docx can carry.
      renderAltChunks: false,
      // Honor the page breaks Word saved, so the first page is really page one.
      ignoreLastRenderedPageBreak: false,
    })
      .then(() => {
        if (cancelled) return;
        sanitizeLinks(holder);

        if (mode === "thumb") {
          // Scale the first page down to the thumbnail; CSS hides the rest.
          const wrapper = holder.querySelector<HTMLElement>(".docx-wrapper");
          const page = holder.querySelector<HTMLElement>("section.docx");
          if (wrapper && page && page.offsetWidth > 0) {
            wrapper.style.transform = `scale(${RESUME_THUMB_WIDTH / page.offsetWidth})`;
          }
        }
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      holder.remove();
    };
  }, [file, mode]);

  return (
    <div
      ref={hostRef}
      className={mode === "thumb" ? "resume-docx-thumb" : "resume-docx-full"}
      aria-busy={state === "rendering"}
    >
      {state === "rendering" ? <p className="resume-status">Loading preview...</p> : null}
      {state === "error" ? (
        <p role="alert" className="resume-status">We couldn&apos;t preview this document.</p>
      ) : null}
    </div>
  );
}
