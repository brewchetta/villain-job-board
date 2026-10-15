import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RESUME_BYTES, RESUME_TYPES } from "@/lib/resume";
import { createQueryBuilder } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { removeResume, requestResumeUpload, saveResume } from "./actions";

const upload = (ext: "pdf" | "docx", overrides: Record<string, unknown> = {}) => ({
  id: "obj-1",
  name: `resume.${ext}`,
  metadata: { size: 1000, mimetype: RESUME_TYPES[ext] },
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();

  mocks.requireUser.mockResolvedValue({ id: "u1", email: "a@b.co" });
  mocks.storageFrom.mockReturnValue({
    createSignedUploadUrl: mocks.createSignedUploadUrl,
    list: mocks.list,
    remove: mocks.remove,
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  });
  mocks.remove.mockResolvedValue({ error: null });
});

describe("requestResumeUpload", () => {
  beforeEach(() => {
    mocks.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://x.supabase.co/signed?token=t", token: "t", path: "u1/resume.pdf" },
      error: null,
    });
  });

  it("requires a signed-in user before touching storage", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(requestResumeUpload({ name: "cv.pdf", size: 10 })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("signs an upload to the user's own folder in the resumes bucket", async () => {
    const result = await requestResumeUpload({ name: "My CV.PDF", size: 1000 });

    expect(mocks.storageFrom).toHaveBeenCalledWith("resumes");
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith("u1/resume.pdf", { upsert: true });
    expect(result).toEqual({ uploadUrl: "https://x.supabase.co/signed?token=t", ext: "pdf" });
  });

  it("never lets the file name choose the path", async () => {
    await requestResumeUpload({ name: "../../other-user/evil.docx", size: 1000 });

    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith("u1/resume.docx", { upsert: true });
  });

  it.each([
    ["an unsupported type", { name: "cv.exe", size: 10 }, "Choose a PDF or DOCX file."],
    ["an old .doc file", { name: "cv.doc", size: 10 }, "Choose a PDF or DOCX file."],
    ["an empty file", { name: "cv.pdf", size: 0 }, "That file is empty."],
    ["a too-large file", { name: "cv.pdf", size: MAX_RESUME_BYTES + 1 }, "Resumes must be 5 MB or smaller."],
    ["a non-numeric size", { name: "cv.pdf", size: Number.NaN }, "That file is empty."],
  ])("refuses %s", async (_label, file, error) => {
    await expect(requestResumeUpload(file)).resolves.toEqual({ error });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("accepts a file of exactly the maximum size", async () => {
    const result = await requestResumeUpload({ name: "cv.pdf", size: MAX_RESUME_BYTES });

    expect(result).toHaveProperty("uploadUrl");
  });

  it("hides storage errors behind a generic message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSignedUploadUrl.mockResolvedValue({ data: null, error: { name: "StorageApiError", message: "bucket secret detail" } });

    const result = await requestResumeUpload({ name: "cv.pdf", size: 10 });

    expect(result).toEqual({ error: "Could not start the upload. Please try again." });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(log).toHaveBeenCalled();
  });
});

describe("saveResume", () => {
  let profileQuery: ReturnType<typeof createQueryBuilder>;

  beforeEach(() => {
    mocks.list.mockResolvedValue({ data: [upload("pdf")], error: null });
    profileQuery = createQueryBuilder({ data: [{ id: "u1" }], error: null });
    mocks.from.mockReturnValue(profileQuery);
  });

  it("requires a signed-in user before touching storage", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(saveResume("pdf")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("rejects an unknown extension", async () => {
    await expect(saveResume("exe")).resolves.toEqual({ error: "Choose a PDF or DOCX file." });
    await expect(saveResume("toString")).resolves.toEqual({ error: "Choose a PDF or DOCX file." });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("points the profile at the verified upload and refreshes /account", async () => {
    const result = await saveResume("pdf");

    expect(mocks.list).toHaveBeenCalledWith("u1");
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(profileQuery.update).toHaveBeenCalledWith({ resume_id: "obj-1", resume_path: "u1/resume.pdf" });
    expect(profileQuery.eq).toHaveBeenCalledWith("id", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");
    expect(result).toEqual({ message: "Resume uploaded." });
  });

  it("removes the other format left from an earlier upload", async () => {
    await saveResume("pdf");

    expect(mocks.remove).toHaveBeenCalledWith(["u1/resume.docx"]);
  });

  it("fails when the file is not in the user's folder", async () => {
    mocks.list.mockResolvedValue({ data: [upload("docx")], error: null });

    const result = await saveResume("pdf");

    expect(result).toEqual({ error: "We couldn't find your upload. Please try again." });
    expect(profileQuery.update).not.toHaveBeenCalled();
  });

  it.each([
    ["oversized", { metadata: { size: MAX_RESUME_BYTES + 1, mimetype: RESUME_TYPES.pdf } }],
    ["the wrong type", { metadata: { size: 10, mimetype: "text/html" } }],
    ["missing size metadata", { metadata: { mimetype: RESUME_TYPES.pdf } }],
  ])("deletes and rejects an upload that is %s", async (_label, overrides) => {
    mocks.list.mockResolvedValue({ data: [upload("pdf", overrides)], error: null });

    const result = await saveResume("pdf");

    expect(result.error).toBe("That file isn't a valid PDF or DOCX under 5 MB.");
    expect(mocks.remove).toHaveBeenCalledWith(["u1/resume.pdf"]);
    expect(profileQuery.update).not.toHaveBeenCalled();
  });

  it("reports a listing failure generically", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.list.mockResolvedValue({ data: null, error: { name: "StorageApiError", message: "detail" } });

    const result = await saveResume("pdf");

    expect(result).toEqual({ error: "Could not check your upload. Please try again." });
    expect(log).toHaveBeenCalled();
  });

  it("reports a failed profile update and does not refresh", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: "42501", message: "policy detail" } }));

    const result = await saveResume("pdf");

    expect(result).toEqual({ error: "Could not save your resume. Please try again." });
    expect(JSON.stringify(result)).not.toContain("policy");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("treats an update that matched no profile row as a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.from.mockReturnValue(createQueryBuilder({ data: [], error: null }));

    const result = await saveResume("pdf");

    expect(result.error).toBe("Could not save your resume. Please try again.");
  });

  it("still succeeds when cleaning up the other format fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.remove.mockResolvedValue({ error: { name: "StorageApiError" } });

    const result = await saveResume("pdf");

    expect(result).toEqual({ message: "Resume uploaded." });
    expect(log).toHaveBeenCalled();
  });
});

describe("removeResume", () => {
  it("requires a signed-in user before touching storage", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(removeResume()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes both formats from the user's folder and clears the profile", async () => {
    const query = createQueryBuilder({ data: null, error: null });
    mocks.from.mockReturnValue(query);

    const result = await removeResume();

    expect(mocks.remove).toHaveBeenCalledWith(["u1/resume.pdf", "u1/resume.docx"]);
    expect(query.update).toHaveBeenCalledWith({ resume_id: null, resume_path: null });
    expect(query.eq).toHaveBeenCalledWith("id", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");
    expect(result).toEqual({ message: "Resume removed." });
  });

  it("leaves the profile alone when the files could not be deleted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.remove.mockResolvedValue({ error: { name: "StorageApiError" } });

    const result = await removeResume();

    expect(result).toEqual({ error: "Could not remove your resume. Please try again." });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a failed profile update", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: "42501" } }));

    const result = await removeResume();

    expect(result).toEqual({ error: "Could not remove your resume. Please try again." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
