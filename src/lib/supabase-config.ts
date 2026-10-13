// Shared Supabase settings for every server-side client (cookie-less, per-request
// and proxy). Deliberately has no "server-only" import: proxy.ts uses it too.

// Session cookies hold the access and refresh tokens. All auth runs on the
// server, so scripts have no reason to read them: HttpOnly keeps a future XSS
// bug from stealing the refresh token. `secure` is production-only so
// `npm run dev` over plain http keeps working. maxAge is rolling: the cookie is
// rewritten whenever the token refreshes, so active users stay signed in.
//
// If a browser-side Supabase client is ever added, it cannot read these cookies
// and this will need revisiting.
export const SUPABASE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
} as const;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Keep only the origin so a trailing slash or path (e.g. /rest/v1) in the env
// var can't produce a malformed request URL. Passwords, tokens and the key all
// travel to this origin, so refuse plain http except for local development.
export function getSupabaseOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    // Don't include the value: it may be a mis-pasted secret.
    throw new Error(
      "SUPABASE_URL is not a valid URL. It should look like https://<project-ref>.supabase.co.",
    );
  }
  const isLocalHttp = parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("SUPABASE_URL must use https (http is only allowed for localhost).");
  }

  return parsed.origin;
}
