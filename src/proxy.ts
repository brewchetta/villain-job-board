import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keeps the Supabase session fresh: refreshes expiring tokens and writes the
// updated cookies to both the request (so server code sees them) and the
// response (so the browser stores them). It does not protect routes; pages and
// server actions must verify the user themselves.
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  // Don't take the whole site down if env vars are missing; data access will
  // surface a clear error instead.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(new URL(url.trim()).origin, key.trim(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Responses that set auth cookies must not be cached by a CDN.
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // Validates the JWT and refreshes the session if needed. Don't remove.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Skip static files, image optimization, and the public chat endpoint (no session needed).
    "/((?!api/chat|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
