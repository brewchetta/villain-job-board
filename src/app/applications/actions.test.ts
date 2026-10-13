import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { applyToJob, withdrawApplication } from "./actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.revalidatePath.mockClear();
  mocks.rpc.mockReset();
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue({ id: "u1", email: "a@b.co" });
  mocks.createSupabaseServerClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("applyToJob", () => {
  it("requires a signed-in user before touching the database", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(applyToJob({}, form({ job_id: "henchperson" }))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses a submission with no job id", async () => {
    const state = await applyToJob({}, form({ referral_code: "E-1" }));

    expect(state).toEqual({ error: "Missing job.", values: { referral_code: "E-1" } });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls apply_to_job with the job and a trimmed referral code", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    const state = await applyToJob({}, form({ job_id: "henchperson", referral_code: "  E-42  " }));

    expect(mocks.rpc).toHaveBeenCalledWith("apply_to_job", {
      p_job_id: "henchperson",
      p_referral_code: "E-42",
    });
    expect(state).toEqual({ message: "Application submitted. Good luck, villain." });
  });

  it("sends null when the referral code is blank", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await applyToJob({}, form({ job_id: "henchperson", referral_code: "   " }));

    expect(mocks.rpc.mock.calls[0][1].p_referral_code).toBeNull();
  });

  it("caps the referral code at 50 characters", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await applyToJob({}, form({ job_id: "henchperson", referral_code: "z".repeat(80) }));

    expect(mocks.rpc.mock.calls[0][1].p_referral_code).toBe("z".repeat(50));
  });

  it("never sends a user id: the database function uses the session", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await applyToJob({}, form({ job_id: "henchperson", user_id: "someone-else" }));

    expect(Object.keys(mocks.rpc.mock.calls[0][1]).sort()).toEqual(["p_job_id", "p_referral_code"]);
  });

  it("refreshes the job page and the account page after a successful apply", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await applyToJob({}, form({ job_id: "henchperson" }));

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jobs/henchperson");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");
  });

  describe("errors", () => {
    it("shows messages from our own database functions (P0001) to the user", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "P0001", message: "You have already applied to this job." } });

      const state = await applyToJob({}, form({ job_id: "henchperson", referral_code: "E-1" }));

      expect(state).toEqual({
        error: "You have already applied to this job.",
        values: { referral_code: "E-1" },
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("explains a foreign key violation (the job was deleted)", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "23503", message: "violates foreign key constraint" } });

      const state = await applyToJob({}, form({ job_id: "gone" }));

      expect(state.error).toBe("That job no longer exists.");
    });

    it("hides any other database error behind a generic message", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "42P01", message: 'relation "applications" does not exist' } });

      const state = await applyToJob({}, form({ job_id: "henchperson" }));

      expect(state.error).toBe("Something went wrong. Please try again.");
      expect(JSON.stringify(state)).not.toContain("relation");
    });
  });
});

describe("withdrawApplication", () => {
  it("requires a signed-in user before touching the database", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(withdrawApplication({}, form({ application_id: "a1" }))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses a submission with no application id", async () => {
    const state = await withdrawApplication({}, form({}));

    expect(state).toEqual({ error: "Missing application." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls withdraw_application and refreshes the affected pages", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    const state = await withdrawApplication({}, form({ application_id: "a1" }));

    expect(mocks.rpc).toHaveBeenCalledWith("withdraw_application", { p_application_id: "a1" });
    expect(state).toEqual({ message: "Application withdrawn." });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jobs/[id]", "page");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");
  });

  it("passes through user-facing database errors and hides the rest", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "P0001", message: "Application not found." } });
    await expect(withdrawApplication({}, form({ application_id: "a1" }))).resolves.toEqual({
      error: "Application not found.",
    });

    mocks.rpc.mockResolvedValueOnce({ error: { code: "XX000", message: "internal detail" } });
    await expect(withdrawApplication({}, form({ application_id: "a1" }))).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
