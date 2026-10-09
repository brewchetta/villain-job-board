import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DOCS, fetchDoc } from "./hr-doc-sources";

export type HrDoc = { code: string; title: string; text: string };

// All six docs in full. Used when retrieval is switched off (HR_RETRIEVAL=off) or
// as the fallback when the vector search fails. Docs that fail to load are skipped,
// and it throws if none load: a thrown result is not cached, so a temporary outage
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
