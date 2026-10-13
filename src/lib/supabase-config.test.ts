import { describe, expect, it, vi } from "vitest";
import { SUPABASE_COOKIE_OPTIONS, getSupabaseOrigin } from "./supabase-config";

describe("getSupabaseOrigin", () => {
  it("returns just the origin of an https URL", () => {
    expect(getSupabaseOrigin("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });

  it("strips trailing slashes, paths and queries", () => {
    expect(getSupabaseOrigin("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
    expect(getSupabaseOrigin("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
    expect(getSupabaseOrigin("https://abc.supabase.co/rest/v1/?x=1")).toBe("https://abc.supabase.co");
  });

  it("trims surrounding whitespace", () => {
    expect(getSupabaseOrigin("  https://abc.supabase.co \n")).toBe("https://abc.supabase.co");
  });

  it("keeps a non-default port", () => {
    expect(getSupabaseOrigin("https://abc.supabase.co:8443/x")).toBe("https://abc.supabase.co:8443");
  });

  it.each([
    ["http://localhost:54321", "http://localhost:54321"],
    ["http://127.0.0.1:54321/", "http://127.0.0.1:54321"],
    ["http://[::1]:54321", "http://[::1]:54321"],
  ])("allows plain http for local development (%s)", (input, expected) => {
    expect(getSupabaseOrigin(input)).toBe(expected);
  });

  it.each(["http://abc.supabase.co", "http://192.168.1.10:54321", "http://localhost.evil.com"])(
    "rejects plain http for non-local host %s",
    (input) => {
      expect(() => getSupabaseOrigin(input)).toThrow(/must use https/);
    },
  );

  it("rejects other protocols", () => {
    expect(() => getSupabaseOrigin("ftp://abc.supabase.co")).toThrow(/must use https/);
  });

  it("throws on a malformed URL", () => {
    expect(() => getSupabaseOrigin("not a url")).toThrow(/not a valid URL/);
    expect(() => getSupabaseOrigin("")).toThrow(/not a valid URL/);
  });

  it("does not echo the malformed value in the error", () => {
    expect(() => getSupabaseOrigin("secret-looking-value")).not.toThrow(/secret-looking-value/);
  });
});

describe("SUPABASE_COOKIE_OPTIONS", () => {
  it("is HttpOnly, lax, site-wide and lasts seven days", () => {
    expect(SUPABASE_COOKIE_OPTIONS).toMatchObject({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  it("is Secure only in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const prod = await import("./supabase-config");
    expect(prod.SUPABASE_COOKIE_OPTIONS.secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const dev = await import("./supabase-config");
    expect(dev.SUPABASE_COOKIE_OPTIONS.secure).toBe(false);
  });
});
