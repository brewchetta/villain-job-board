import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    // Real redirect() throws to stop rendering.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  requireUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { logIn, logOut, signUp, updateProfile } from "./actions";

const auth = { signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() };
const from = vi.fn();

const CHECK_EMAIL = /check your inbox/i;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.signOut.mockReset();
  from.mockReset();
  mocks.redirect.mockClear();
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue({ id: "u1", email: "a@b.co" });
  mocks.createSupabaseServerClient.mockResolvedValue({ auth, from });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signUp", () => {
  const good = { email: "ada@garden.test", password: "correct horse" };

  describe("validation", () => {
    it("rejects an email without @, echoing the values back but never the password", async () => {
      const state = await signUp({}, form({ email: "nope", password: "correct horse", first_name: "Ada" }));

      expect(state.error).toBe("Enter a valid email address.");
      expect(state.values).toMatchObject({ email: "nope", first_name: "Ada" });
      expect(state.values).not.toHaveProperty("password");
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it("rejects a password shorter than 8 characters", async () => {
      const state = await signUp({}, form({ email: good.email, password: "1234567" }));
      expect(state.error).toBe("Password must be at least 8 characters.");
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it("accepts a password of exactly 8 characters", async () => {
      auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
      const state = await signUp({}, form({ email: good.email, password: "12345678" }));
      expect(state.error).toBeUndefined();
      expect(auth.signUp).toHaveBeenCalled();
    });

    it("counts bytes, not characters, for the 72-byte bcrypt limit", async () => {
      // 37 two-byte characters = 37 chars but 74 bytes.
      const state = await signUp({}, form({ email: good.email, password: "é".repeat(37) }));
      expect(state.error).toBe("Password must be 72 characters or fewer.");
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it("accepts a password of exactly 72 bytes", async () => {
      auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
      const state = await signUp({}, form({ email: good.email, password: "a".repeat(72) }));
      expect(state.error).toBeUndefined();
      expect(auth.signUp).toHaveBeenCalled();
    });

    it("rejects a 73-byte password", async () => {
      const state = await signUp({}, form({ email: good.email, password: "a".repeat(73) }));
      expect(state.error).toBe("Password must be 72 characters or fewer.");
    });
  });

  describe("request to Supabase", () => {
    beforeEach(() => {
      auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    });

    it("trims the email and sends only non-empty profile fields as metadata", async () => {
      await signUp(
        {},
        form({
          email: "  ada@garden.test  ",
          password: good.password,
          first_name: "  Ada ",
          last_name: "",
          evil_nickname: "The Pruner",
        }),
      );

      expect(auth.signUp).toHaveBeenCalledWith({
        email: "ada@garden.test",
        password: good.password,
        options: { data: { first_name: "Ada", evil_nickname: "The Pruner" } },
      });
    });

    it("never forwards a role supplied by the client", async () => {
      await signUp({}, form({ ...good, role: "admin", first_name: "Ada" }));

      const { options } = auth.signUp.mock.calls[0][0];
      expect(options.data).not.toHaveProperty("role");
      expect(JSON.stringify(auth.signUp.mock.calls[0][0])).not.toContain("admin");
    });

    it("does not trim the password", async () => {
      await signUp({}, form({ email: good.email, password: "  spaced out  " }));
      expect(auth.signUp.mock.calls[0][0].password).toBe("  spaced out  ");
    });

    it("caps each field at 200 characters", async () => {
      await signUp({}, form({ ...good, display_name: "x".repeat(500) }));
      expect(auth.signUp.mock.calls[0][0].options.data.display_name).toHaveLength(200);
    });
  });

  describe("outcomes", () => {
    it("redirects to /account when Supabase returns a session", async () => {
      auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
      await expect(signUp({}, form(good))).rejects.toThrow("NEXT_REDIRECT:/account");
    });

    it("asks to check the inbox when email confirmation is required (no session)", async () => {
      auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
      const state = await signUp({}, form(good));
      expect(state.message).toMatch(CHECK_EMAIL);
      expect(state.error).toBeUndefined();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it.each(["user_already_exists", "email_exists"])(
      "answers an already-registered email (%s) exactly like a fresh sign-up",
      async (code) => {
        auth.signUp.mockResolvedValue({ data: { session: null }, error: { code, status: 422, message: "exists" } });
        const fresh = await (async () => {
          auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
          return signUp({}, form(good));
        })();
        const duplicate = await signUp({}, form(good));

        expect(duplicate).toEqual(fresh);
        expect(console.error).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["weak_password", "That password is too weak. Try a longer or less common one."],
      ["email_address_invalid", "Enter a valid email address."],
      ["over_request_rate_limit", "Too many attempts. Please wait a few minutes and try again."],
      ["over_email_send_rate_limit", "Too many attempts. Please wait a few minutes and try again."],
      ["something_unexpected", "We couldn't create your account. Please try again."],
      [undefined, "We couldn't create your account. Please try again."],
    ])("maps error code %s to our own wording", async (code, expected) => {
      auth.signUp.mockResolvedValue({ data: { session: null }, error: { code, status: 400, message: "RAW SUPABASE TEXT" } });

      const state = await signUp({}, form(good));

      expect(state.error).toBe(expected);
      expect(JSON.stringify(state)).not.toContain("RAW SUPABASE TEXT");
    });

    it("logs only the code and status, never the message or the email", async () => {
      auth.signUp.mockResolvedValue({
        data: { session: null },
        error: { code: "weak_password", status: 422, message: `bad password for ${good.email}` },
      });

      await signUp({}, form(good));

      expect(console.error).toHaveBeenCalledWith("auth.signup failed", { code: "weak_password", status: 422 });
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(good.email);
    });
  });
});

describe("logIn", () => {
  it("signs in with the trimmed email and the password as typed, then redirects", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });

    await expect(logIn({}, form({ email: " ada@garden.test ", password: " pw " }))).rejects.toThrow(
      "NEXT_REDIRECT:/account",
    );
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ada@garden.test", password: " pw " });
  });

  it("gives one vague error for any failure and echoes only the email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login" } });

    const state = await logIn({}, form({ email: "ada@garden.test", password: "wrong" }));

    expect(state).toEqual({ error: "Invalid email or password.", values: { email: "ada@garden.test" } });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("logOut", () => {
  const cookieStore = { getAll: vi.fn(), delete: vi.fn() };

  beforeEach(() => {
    cookieStore.getAll.mockReset();
    cookieStore.delete.mockReset();
    mocks.cookies.mockResolvedValue(cookieStore);
  });

  it("signs out and redirects home without touching cookies when it succeeds", async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await expect(logOut()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(cookieStore.delete).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("clears the Supabase auth cookies itself when signOut fails, leaving others alone", async () => {
    auth.signOut.mockResolvedValue({ error: { code: "network", status: 500 } });
    cookieStore.getAll.mockReturnValue(
      [
        "sb-abc123-auth-token",
        "sb-abc123-auth-token.0",
        "sb-abc123-auth-token.1",
        "sb-abc123-auth-token-code-verifier",
        "theme",
        "other-auth-token",
      ].map((name) => ({ name, value: "x" })),
    );

    await expect(logOut()).rejects.toThrow("NEXT_REDIRECT:/");

    const deleted = cookieStore.delete.mock.calls.map(([name]) => name);
    expect(deleted).toEqual(["sb-abc123-auth-token", "sb-abc123-auth-token.0", "sb-abc123-auth-token.1"]);
    expect(console.error).toHaveBeenCalledWith("auth.logout failed", { code: "network", status: 500 });
  });
});

describe("updateProfile", () => {
  const values = { display_name: "Ada", first_name: "Ada", last_name: "", phone_number: "", evil_nickname: "The Pruner" };

  it("requires a signed-in user before doing anything", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(updateProfile({}, form(values))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(from).not.toHaveBeenCalled();
  });

  it("updates only the caller's own row, turning blanks into null and never touching role", async () => {
    const query = createQueryBuilder({ data: [{ id: "u1" }], error: null });
    from.mockReturnValue(query);

    const state = await updateProfile({}, form({ ...values, role: "admin", id: "someone-else" }));

    expect(state).toEqual({ message: "Profile saved.", values });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(query.update).toHaveBeenCalledWith({
      display_name: "Ada",
      first_name: "Ada",
      last_name: null,
      phone_number: null,
      evil_nickname: "The Pruner",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "u1");
  });

  it("trims and caps submitted values", async () => {
    const query = createQueryBuilder({ data: [{ id: "u1" }], error: null });
    from.mockReturnValue(query);

    await updateProfile({}, form({ ...values, first_name: `  ${"y".repeat(300)}  ` }));

    expect(query.update.mock.calls[0][0].first_name).toBe("y".repeat(200));
  });

  it("returns a generic error and logs the details when the database fails", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { code: "42501", message: 'policy "profiles_update" on table' } }));

    const state = await updateProfile({}, form(values));

    expect(state).toEqual({ error: "Could not save your profile. Please try again.", values });
    expect(JSON.stringify(state)).not.toContain("profiles_update");
    expect(console.error).toHaveBeenCalledWith("profile.update failed", {
      code: "42501",
      message: 'policy "profiles_update" on table',
    });
  });

  it("reports a missing profile when no row was updated", async () => {
    from.mockReturnValue(createQueryBuilder({ data: [], error: null }));

    const state = await updateProfile({}, form(values));

    expect(state.error).toMatch(/No profile found/);
    expect(state.message).toBeUndefined();
  });
});
