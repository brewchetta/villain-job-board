// The only access point for Voyage AI embeddings (Anthropic has no embedding
// model of its own). Server-only by convention: VOYAGE_API_KEY has no NEXT_PUBLIC_
// prefix. It deliberately avoids the "server-only" package so the ingest script
// (scripts/ingest-hr-docs.ts) can import it too.
export const VOYAGE_MODEL = "voyage-4-lite";
// Must match the vector(...) size of hr_chunks.embedding in supabase/schema.sql.
export const EMBEDDING_DIMENSIONS = 1024;

type VoyageResponse = { data?: { embedding?: number[]; index?: number }[] };

// "document" when storing chunks, "query" when searching: Voyage tunes each differently.
// Ingest and search must use the same model.
export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  // Never include the response body or request in errors: just the status.
  if (!res.ok) throw new Error(`Voyage API responded ${res.status}`);

  const json = (await res.json()) as VoyageResponse;
  const vectors = (json.data ?? [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => d.embedding);

  if (vectors.length !== texts.length || vectors.some((v) => v?.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("Voyage API returned an unexpected response");
  }
  return vectors as number[][];
}
