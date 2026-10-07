import { createClient } from "@supabase/supabase-js";

// Server-only: these env vars have no NEXT_PUBLIC_ prefix, so they are never
// sent to the browser. Only import this module from server code.
export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  // Keep only the origin so a trailing slash or path (e.g. /rest/v1) in the
  // env var can't produce a malformed request URL.
  const origin = new URL(url.trim()).origin;

  return createClient(origin, key.trim(), { auth: { persistSession: false } });
}
