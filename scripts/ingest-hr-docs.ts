// Loads the HR docs into the hr_chunks table: fetch, chunk, embed with Voyage, store.
// Run with `npm run ingest` (re-run it whenever a Google Doc changes). Needs
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VOYAGE_API_KEY in .env.local.
// The service-role key is for this script only; the app never uses it.
import { createClient } from "@supabase/supabase-js";
import { embed, VOYAGE_MODEL } from "../src/lib/embeddings";
import { chunkDoc } from "../src/lib/hr-chunking";
import { DOCS, fetchDoc } from "../src/lib/hr-doc-sources";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example).");
  }
  const supabase = createClient(new URL(url.trim()).origin, key.trim(), {
    auth: { persistSession: false },
  });

  // Fail before touching the table if any doc can't be fetched, so a half-loaded
  // set can never replace a good one.
  const rows: { doc_code: string; doc_title: string; chunk_index: number; content: string }[] = [];
  for (const { code, title, id } of DOCS) {
    let text: string;
    try {
      text = await fetchDoc(id);
    } catch (err) {
      throw new Error(`${code}: ${err instanceof Error ? err.message : "could not fetch"}`);
    }
    const chunks = chunkDoc(text);
    console.log(`${code} ${title}: ${chunks.length} chunks`);
    chunks.forEach((content, chunk_index) => rows.push({ doc_code: code, doc_title: title, chunk_index, content }));
  }

  // Prefix each chunk with its doc so the vector knows where it came from.
  const vectors = await embed(rows.map((r) => `${r.doc_code} ${r.doc_title}\n${r.content}`), "document");
  console.log(`Embedded ${rows.length} chunks with ${VOYAGE_MODEL}`);

  // Insert the new rows first, then delete the old ones, so the table is never empty.
  const { data: last, error: lastError } = await supabase
    .from("hr_chunks")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  if (lastError) throw new Error(`Reading hr_chunks failed: ${lastError.message}`);
  const previousMaxId = last?.[0]?.id ?? 0;

  const { error: insertError } = await supabase
    .from("hr_chunks")
    .insert(rows.map((row, i) => ({ ...row, embedding: vectors[i] })));
  if (insertError) throw new Error(`Inserting chunks failed: ${insertError.message}`);

  if (previousMaxId > 0) {
    const { error: deleteError } = await supabase.from("hr_chunks").delete().lte("id", previousMaxId);
    if (deleteError) throw new Error(`Removing old chunks failed: ${deleteError.message}`);
  }
  console.log(`Done: hr_chunks now holds ${rows.length} chunks.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
