import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "@/test/supabase-mock";

const { createSupabaseServerClient, from } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase-server", () => ({ createSupabaseServerClient }));

import { getMyApplicationForJob, getMyApplications } from "./applications";

beforeEach(() => {
  from.mockReset();
  createSupabaseServerClient.mockResolvedValue({ from });
});

describe("getMyApplicationForJob", () => {
  it("filters by BOTH user and job so an admin never sees someone else's row", async () => {
    const query = createQueryBuilder({ data: { id: "a1", status: "submitted" }, error: null });
    from.mockReturnValue(query);

    await expect(getMyApplicationForJob("u1", "henchperson")).resolves.toEqual({
      id: "a1",
      status: "submitted",
    });

    expect(from).toHaveBeenCalledWith("applications");
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(query.eq).toHaveBeenCalledWith("job_id", "henchperson");
  });

  it("returns null when the user hasn't applied", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    await expect(getMyApplicationForJob("u1", "x")).resolves.toBeNull();
  });

  it("throws when the query fails", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "rls" } }));
    await expect(getMyApplicationForJob("u1", "x")).rejects.toThrow("Failed to load application: rls");
  });
});

describe("getMyApplications", () => {
  const row = {
    id: "a1",
    job_id: "henchperson",
    status: "reviewing",
    referral_code: "E-42",
    created_at: "2026-10-01T00:00:00Z",
  };

  it("filters by user and lists newest first", async () => {
    const query = createQueryBuilder({ data: [], error: null });
    from.mockReturnValue(query);

    await getMyApplications("u1");

    expect(from).toHaveBeenCalledWith("applications");
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("flattens the embedded job when it comes back as an object", async () => {
    from.mockReturnValue(createQueryBuilder({ data: [{ ...row, jobs: { title: "Henchperson" } }], error: null }));

    await expect(getMyApplications("u1")).resolves.toEqual([
      { ...row, job_title: "Henchperson" },
    ]);
  });

  it("flattens the embedded job when it comes back as a one-item array", async () => {
    from.mockReturnValue(createQueryBuilder({ data: [{ ...row, jobs: [{ title: "Mad Scientist" }] }], error: null }));

    const [application] = await getMyApplications("u1");
    expect(application.job_title).toBe("Mad Scientist");
  });

  it("falls back to the job id when the job is gone", async () => {
    from.mockReturnValue(
      createQueryBuilder({
        data: [
          { ...row, jobs: null },
          { ...row, id: "a2", jobs: [] },
        ],
        error: null,
      }),
    );

    const applications = await getMyApplications("u1");
    expect(applications.map((a) => a.job_title)).toEqual(["henchperson", "henchperson"]);
  });

  it("only returns the fields the app uses", async () => {
    from.mockReturnValue(createQueryBuilder({ data: [{ ...row, jobs: { title: "T" }, user_id: "leak" }], error: null }));

    const [application] = await getMyApplications("u1");
    expect(Object.keys(application).sort()).toEqual(
      ["created_at", "id", "job_id", "job_title", "referral_code", "status"],
    );
  });

  it("returns an empty list when there is no data", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    await expect(getMyApplications("u1")).resolves.toEqual([]);
  });

  it("throws when the query fails", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "boom" } }));
    await expect(getMyApplications("u1")).rejects.toThrow("Failed to load applications: boom");
  });
});
