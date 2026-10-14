import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  next: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/server", () => ({ NextResponse: { next: mocks.next } }));

import { config, proxy } from "./proxy";

type Cookie = { name: string; value: string; options?: object };

function makeRequest(initial: Cookie[] = []) {
  const store = new Map(initial.map((c) => [c.name, c.value]));
  return {
    cookies: {
      getAll: () => [...store].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => store.set(name, value),
    },
  };
}

function makeResponse() {
  const cookies = new Map<string, { value: string; options?: object }>();
  const headers = new Map<string, string>();
  return {
    cookies: { set: (name: string, value: string, options?: object) => cookies.set(name, { value, options }) },
    headers: { set: (name: string, value: string) => headers.set(name, value) },
    _cookies: cookies,
    _headers: headers,
  };
}

beforeEach(() => {
  mocks.createServerClient.mockReset();
  mocks.getClaims.mockReset();
  mocks.next.mockReset();
  mocks.next.mockImplementation(() => makeResponse());
  mocks.createServerClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  mocks.getClaims.mockResolvedValue({ data: null, error: null });
  vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", " key ");
});

describe("proxy", () => {
  it("passes the request through untouched when env vars are missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const request = makeRequest();

    await proxy(request as never);

    expect(mocks.next).toHaveBeenCalledWith({ request });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("passes the request through when the URL is malformed or not https", async () => {
    for (const bad of ["not a url", "http://abc.supabase.co"]) {
      vi.stubEnv("SUPABASE_URL", bad);
      mocks.next.mockClear();
      const request = makeRequest();

      await expect(proxy(request as never)).resolves.toBeDefined();
      expect(mocks.next).toHaveBeenCalledWith({ request });
    }
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("builds a cookie-based client from the normalized origin and trimmed key", async () => {
    await proxy(makeRequest() as never);

    const [origin, key, options] = mocks.createServerClient.mock.calls[0];
    expect(origin).toBe("https://abc.supabase.co");
    expect(key).toBe("key");
    expect(options.cookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("refreshes the session by calling getClaims", async () => {
    await proxy(makeRequest() as never);
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
  });

  it("reads cookies from the incoming request", async () => {
    await proxy(makeRequest([{ name: "sb-x-auth-token", value: "abc" }]) as never);

    const { cookies } = mocks.createServerClient.mock.calls[0][2];
    expect(cookies.getAll()).toEqual([{ name: "sb-x-auth-token", value: "abc" }]);
  });

  it("writes refreshed cookies to BOTH the request and the response, and stops CDN caching", async () => {
    const request = makeRequest();

    // Simulate Supabase refreshing the token during getClaims().
    mocks.getClaims.mockImplementation(async () => {
      const { cookies } = mocks.createServerClient.mock.calls.at(-1)![2];
      cookies.setAll([{ name: "sb-x-auth-token", value: "fresh", options: { httpOnly: true } }], {
        "Cache-Control": "private, no-store",
      });
      return { data: null, error: null };
    });
    const refreshed = (await proxy(request as never)) as unknown as ReturnType<typeof makeResponse>;

    expect(request.cookies.getAll()).toContainEqual({ name: "sb-x-auth-token", value: "fresh" });
    expect(refreshed._cookies.get("sb-x-auth-token")).toEqual({ value: "fresh", options: { httpOnly: true } });
    expect(refreshed._headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("proxy matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/jobs", "/jobs/henchperson", "/account", "/login"])("runs on %s", (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each([
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/logo.png",
    "/hero.webp",
    "/icon.svg",
    "/api/cron/newsletter",
  ])(
    "skips %s",
    (path) => {
      expect(pattern.test(path)).toBe(false);
    },
  );
});
