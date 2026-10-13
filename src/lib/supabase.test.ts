import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ fake: "client" })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createSupabaseClient } from "./supabase";

describe("createSupabaseClient", () => {
  beforeEach(() => {
    createClient.mockClear();
  });

  it("throws a helpful error when SUPABASE_URL is missing", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "key");
    expect(() => createSupabaseClient()).toThrow(/Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/);
  });

  it("throws a helpful error when the key is missing", () => {
    vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => createSupabaseClient()).toThrow(/Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates a cookie-less client with a normalized origin and trimmed key", () => {
    vi.stubEnv("SUPABASE_URL", " https://abc.supabase.co/rest/v1/ ");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "  sb_publishable_123\n");

    expect(createSupabaseClient()).toEqual({ fake: "client" });
    expect(createClient).toHaveBeenCalledWith("https://abc.supabase.co", "sb_publishable_123", {
      auth: { persistSession: false },
    });
  });

  it("refuses a plain-http remote URL", () => {
    vi.stubEnv("SUPABASE_URL", "http://abc.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "key");
    expect(() => createSupabaseClient()).toThrow(/must use https/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
