import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request Supabase client that carries the signed-in user's session
// (cookie-based). Use this for anything user-specific. Public, cacheable data
// (jobs) should keep using the cookie-less client in ./supabase.ts instead,
// since reading cookies makes a route dynamic.
//
// Create a new client for every request; never share one across requests.
export async function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(new URL(url.trim()).origin, key.trim(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on each request.
        }
      },
    },
  });
}
