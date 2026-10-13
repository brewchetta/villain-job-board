import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for Supabase Auth that, unlike the mocks in actions.test.ts,
// actually decides whether credentials are right. It lets these tests exercise the
// whole login -> logout flow through the real server actions.
const mocks = vi.hoisted(() => {
  const accounts = new Map<string, string>([["ada@garden.test", "correct horse battery"]]);
  const session = { email: null as string | null };
  const cookies = new Map<string, string>();

  const auth = {
    signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
      if (accounts.get(email) === password) {
        session.email = email;
        cookies.set("sb-proj-auth-token", `token-for-${email}`);
        return { data: { session: {} }, error: null };
      }
      return { data: { session: null }, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } };
    }),
    signOut: vi.fn(async () => {
      session.email = null;
      cookies.delete("sb-proj-auth-token");
      return { error: null };
    }),
  };

  return {
    accounts,
    session,
    cookies,
    auth,
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...mocks.cookies].map(([name, value]) => ({ name, value })),
    delete: (name: string) => mocks.cookies.delete(name),
  }),
}));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: mocks.auth }),
}));

import { logIn, logOut } from "./actions";

function credentials(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

const INVALID = { error: "Invalid email or password." };

beforeEach(() => {
  mocks.session.email = null;
  mocks.cookies.clear();
  mocks.redirect.mockClear();
  mocks.auth.signInWithPassword.mockClear();
  mocks.auth.signOut.mockClear();
});

describe("logging in", () => {
  it("accepts a registered email with the right password and sends the user to /account", async () => {
    await expect(logIn({}, credentials("ada@garden.test", "correct horse battery"))).rejects.toThrow(
      "NEXT_REDIRECT:/account",
    );

    expect(mocks.session.email).toBe("ada@garden.test");
    expect(mocks.cookies.has("sb-proj-auth-token")).toBe(true);
  });

  it("ignores stray whitespace around the email", async () => {
    await expect(logIn({}, credentials("  ada@garden.test  ", "correct horse battery"))).rejects.toThrow(
      "NEXT_REDIRECT:/account",
    );
  });

  it("rejects the right email with the wrong password", async () => {
    const state = await logIn({}, credentials("ada@garden.test", "wrong password"));

    expect(state).toMatchObject(INVALID);
    expect(mocks.session.email).toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects an email that has no account", async () => {
    const state = await logIn({}, credentials("nobody@garden.test", "correct horse battery"));

    expect(state).toMatchObject(INVALID);
    expect(mocks.session.email).toBeNull();
  });

  it("gives the same answer for a wrong password and an unknown email (no account discovery)", async () => {
    const wrongPassword = await logIn({}, credentials("ada@garden.test", "nope nope nope"));
    const unknownEmail = await logIn({}, credentials("nobody@garden.test", "nope nope nope"));

    expect(wrongPassword.error).toBe(unknownEmail.error);
  });

  it("rejects empty credentials", async () => {
    const state = await logIn({}, credentials("", ""));

    expect(state).toMatchObject(INVALID);
    expect(mocks.session.email).toBeNull();
  });

  it("treats the password as case-sensitive", async () => {
    const state = await logIn({}, credentials("ada@garden.test", "Correct Horse Battery"));
    expect(state).toMatchObject(INVALID);
  });

  it("does not trim the password", async () => {
    const state = await logIn({}, credentials("ada@garden.test", " correct horse battery "));
    expect(state).toMatchObject(INVALID);
  });

  it("never echoes the password back, even on failure", async () => {
    const state = await logIn({}, credentials("ada@garden.test", "wrong password"));

    expect(state.values).toEqual({ email: "ada@garden.test" });
    expect(JSON.stringify(state)).not.toContain("wrong password");
  });

  it("never leaks Supabase's own error text", async () => {
    const state = await logIn({}, credentials("ada@garden.test", "wrong password"));
    expect(JSON.stringify(state)).not.toContain("Invalid login credentials");
  });

  it("allows a retry with the right password after a failed attempt", async () => {
    await logIn({}, credentials("ada@garden.test", "wrong password"));
    await expect(logIn({}, credentials("ada@garden.test", "correct horse battery"))).rejects.toThrow(
      "NEXT_REDIRECT:/account",
    );
  });
});

describe("logging out", () => {
  it("ends the session, clears the auth cookie and redirects home", async () => {
    await expect(logIn({}, credentials("ada@garden.test", "correct horse battery"))).rejects.toThrow();
    expect(mocks.session.email).toBe("ada@garden.test");

    await expect(logOut()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mocks.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.session.email).toBeNull();
    expect(mocks.cookies.has("sb-proj-auth-token")).toBe(false);
  });

  it("still redirects home when nobody was signed in", async () => {
    await expect(logOut()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("cannot be used to log back in: after logout the old credentials still need typing", async () => {
    await expect(logIn({}, credentials("ada@garden.test", "correct horse battery"))).rejects.toThrow();
    await expect(logOut()).rejects.toThrow();

    const state = await logIn({}, credentials("ada@garden.test", ""));
    expect(state).toMatchObject(INVALID);
  });
});
