import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "@/test/supabase-mock";
import type { Job } from "./types";

const { cacheLife, cacheTag, from } = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife, cacheTag }));
vi.mock("./supabase", () => ({ createSupabaseClient: () => ({ from }) }));

import { getJobById, getJobs } from "./jobs";

const COLUMNS = "id, title, summary, pay, benefits, qualifications, location, disclaimers";

const henchperson: Job = {
  id: "henchperson",
  title: "Henchperson",
  summary: "Stand menacingly in corridors.",
  pay: "$38,000 - $48,000 per year",
  benefits: ["Dental"],
  qualifications: ["Comfortable standing"],
  location: "Various secret bases",
  disclaimers: ["Not liable for sharks."],
};

beforeEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
  from.mockReset();
});

describe("getJobs", () => {
  it("returns every job, oldest first, from the jobs table", async () => {
    const query = createQueryBuilder({ data: [henchperson], error: null });
    from.mockReturnValue(query);

    await expect(getJobs()).resolves.toEqual([henchperson]);

    expect(from).toHaveBeenCalledWith("jobs");
    expect(query.select).toHaveBeenCalledWith(COLUMNS);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("is cached for minutes under the jobs tag", async () => {
    from.mockReturnValue(createQueryBuilder({ data: [], error: null }));
    await getJobs();

    expect(cacheLife).toHaveBeenCalledWith("minutes");
    expect(cacheTag).toHaveBeenCalledWith("jobs");
  });

  it("throws when Supabase reports an error", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "boom" } }));
    await expect(getJobs()).rejects.toThrow("Failed to load jobs: boom");
  });
});

describe("getJobById", () => {
  it("looks the job up by id", async () => {
    const query = createQueryBuilder({ data: henchperson, error: null });
    from.mockReturnValue(query);

    await expect(getJobById("henchperson")).resolves.toEqual(henchperson);

    expect(from).toHaveBeenCalledWith("jobs");
    expect(query.select).toHaveBeenCalledWith(COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("id", "henchperson");
  });

  it("returns undefined for an unknown id", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    await expect(getJobById("nope")).resolves.toBeUndefined();
  });

  it("is cached under both the jobs tag and a per-job tag", async () => {
    from.mockReturnValue(createQueryBuilder({ data: henchperson, error: null }));
    await getJobById("henchperson");

    expect(cacheLife).toHaveBeenCalledWith("minutes");
    expect(cacheTag).toHaveBeenCalledWith("jobs", "job:henchperson");
  });

  it("throws when Supabase reports an error", async () => {
    from.mockReturnValue(createQueryBuilder({ data: null, error: { message: "denied" } }));
    await expect(getJobById("x")).rejects.toThrow("Failed to load job: denied");
  });
});
