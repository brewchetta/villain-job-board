import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export type HrDoc = { code: string; title: string; text: string };

// The HR docs live in the "Evil HR Docs" Google Drive folder and must be shared
// as "Anyone with the link: Viewer" so the plain-text export URL works without
// credentials. The folder can't be listed without the Drive API, so a new doc
// means adding its id here.
const DOCS = [
  { code: "HR-101", title: "Compensation & Benefits Guide", id: "1TwsBmoFje-yJ-5SJkvtDUZZ6DY2irrNrbIWygCy39aY" },
  { code: "HR-102", title: "Time Off & Leave Policy", id: "1pccjafnjucNj-BYAnR5c45LbIqqBPZOAhh31cWVaud4" },
  { code: "HR-103", title: "Workplace Safety & Incident Reporting", id: "1z8Eg22ILLZUmYGfY4mdbeGlV7GQ9fZEaZ5l7CMdzjrU" },
  { code: "HR-104", title: "Work Location & Remote Work Policy", id: "18QbwN9ySV1BbY1fGB2oOuyTLWM6pI9kHMyWFoCCuwG0" },
  { code: "HR-105", title: "Performance, Advancement & Separation", id: "1I6suophRCmj-HGZjfBsXAcK97U3_fT6jOP_WLeARvBg" },
  { code: "HR-106", title: "Hiring Process & Application FAQ", id: "1ZdnCSmFyDh1TQaIxZJKWp60HE2ToFWFfKImratzkwXE" },
];

async function fetchDoc(id: string): Promise<string> {
  const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`);
  if (!res.ok) throw new Error(`Google Docs responded ${res.status}`);
  // A doc that isn't publicly shared redirects to a Google sign-in page (HTML, status 200).
  if (!res.headers.get("content-type")?.startsWith("text/plain")) {
    throw new Error("Document is not publicly shared");
  }
  // The export starts with a byte order mark.
  return (await res.text()).replace(/^﻿/, "").trim();
}

// The only access point for HR documents. Docs that fail to load are skipped, and
// it throws if none load: a thrown result is not cached, so a temporary outage
// (or docs that aren't shared yet) clears on the next request instead of sticking.
export async function getHrDocs(): Promise<HrDoc[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("hr-docs");

  const results = await Promise.allSettled(DOCS.map(({ id }) => fetchDoc(id)));
  const docs: HrDoc[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      const { code, title } = DOCS[i];
      docs.push({ code, title, text: result.value });
    }
  });

  if (docs.length === 0) throw new Error("No HR documents could be loaded");
  return docs;
}
