"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { RESUME_THUMB_WIDTH } from "@/lib/resume";

// react-pdf needs this set in the same module that renders <Document>; set in a
// shared file, module execution order can let the default overwrite it.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MAX_PAGE_WIDTH = 800;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

// Takes a blob URL rather than bytes: pdf.js transfers (detaches) any ArrayBuffer
// it is given, which breaks when React re-runs an effect or when the thumbnail
// and the modal share one file. A URL can be read as many times as needed. The
// URL belongs to ResumePreview, which revokes it.
export default function PdfViewer({
  url,
  mode,
}: {
  url: string;
  mode: "thumb" | "full";
}) {
  const [pageCount, setPageCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ref, containerWidth] = useWidth();

  if (failed) {
    return <p role="alert" className="resume-status">We couldn&apos;t preview this PDF.</p>;
  }

  const isThumb = mode === "thumb";
  const pages = isThumb ? Math.min(pageCount, 1) : pageCount;
  const pageWidth = isThumb ? RESUME_THUMB_WIDTH : Math.min(containerWidth, MAX_PAGE_WIDTH);

  return (
    <div ref={ref} className={isThumb ? "resume-pdf-thumb" : "resume-pdf-pages"}>
      <Document
        file={url}
        loading={<p className="resume-status">Loading preview...</p>}
        error={<p role="alert" className="resume-status">We couldn&apos;t preview this PDF.</p>}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        onLoadError={() => setFailed(true)}
      >
        {pageWidth > 0
          ? Array.from({ length: pages }, (_, index) => (
              <Page
                key={index}
                pageNumber={index + 1}
                width={pageWidth}
                renderTextLayer={!isThumb}
                renderAnnotationLayer={!isThumb}
              />
            ))
          : null}
      </Document>
    </div>
  );
}
