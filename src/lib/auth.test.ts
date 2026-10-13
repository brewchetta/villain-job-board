import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "@/test/supabase-mock";

const { redirect, createSupabaseServerClient } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    // Real redirect() throws to stop rendering.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./supabase-server", () => ({ createSupabaseServerClient }));

import { getProfile, getSessionUser, requireUser } from "./auth";

const auth = { getClaims: vi.fn(), getUser: vi.fn() };
const from = vi.fn();

beforeEach(() => {
  auth.getClaims.mockReset();
  auth.getUser.mockReset();
  from.mockReset();
  redirect.mockClear();
  createSupabaseServerClient.mockResolvedValue({ auth, from });
});

describe("getSessionUser", () => {
  it("returns the id and email from verified claims", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "a@b.co" } }, error: null });
    await expect(getSessionUser()).resolves.toEqual({ id: "u1", email: "a@b.co" });
  });

  it("returns null when claims can't be read", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: { message: "bad jwt" } });
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns null when there is no subject (signed out)", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("requireUser", () => {
  it("returns the user the Auth server confirms", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co", extra: 1 } }, error: null });
    await expect(requireUser()).resolves.toEqual({ id: "u1", email: "a@b.co" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when the Auth server returns an error", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when there is no user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("authorizes with getUser, never the cheaper getClaims", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } }, error: null });
    await requireUser();
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.getClaims).not.toHaveBeenCalled();
  });
});

describe("getProfile", () => {
  const profile = {
    id: "u1",
    role: "candidate",
    display_name: null,
    first_name: "Ada",
    last_name: null,
    resume_id: null,
    phone_number: null,
    evil_nickname: "The Pruner",
  };

  it("loads the profile row for the given user", async () => {
    const query = createQueryBuilder({ data: profile, error: null });
    from.mockReturnValue(query);

    await expect(getProfile("u1")).resolves.toEqual(profile);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(query.eq).toHaveBeenCalledWith("id", "u1");
  });

  it("returns null when the user has no profile", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    await expect(getProfile("u1")).resolves.toBeNull();
  });

  it("throws when the query fails", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "nope" } }));
    await expect(getProfile("u1")).rejects.toThrow("Failed to load profile: nope");
  });
});
