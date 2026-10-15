import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getProfile: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createSignedUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser, getProfile: mocks.getProfile }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { GET } from "./route";

beforeEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();

  mocks.requireUser.mockResolvedValue({ id: "u1", email: "a@b.co" });
  mocks.getProfile.mockResolvedValue({ resume_path: "u1/resume.pdf" });
  mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  mocks.createSupabaseServerClient.mockResolvedValue({ storage: { from: mocks.storageFrom } });
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://x.supabase.co/signed/resume?token=t" },
    error: null,
  });
});

describe("GET /account/resume", () => {
  it("requires a signed-in user", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(GET()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("redirects to a short-lived signed download link, uncached", async () => {
    const response = await GET();

    expect(mocks.storageFrom).toHaveBeenCalledWith("resumes");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("u1/resume.pdf", 60, { download: "resume.pdf" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://x.supabase.co/signed/resume?token=t");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 when there is no resume on file", async () => {
    mocks.getProfile.mockResolvedValue({ resume_path: null });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no profile", async () => {
    mocks.getProfile.mockResolvedValue(null);

    expect((await GET()).status).toBe(404);
  });

  it("refuses a path outside the user's own folder", async () => {
    mocks.getProfile.mockResolvedValue({ resume_path: "someone-else/resume.pdf" });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("refuses a path with an unexpected extension", async () => {
    mocks.getProfile.mockResolvedValue({ resume_path: "u1/resume.exe" });

    expect((await GET()).status).toBe(404);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns 404 without leaking details when signing fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { name: "StorageApiError", message: "Object not found secret" } });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("secret");
    expect(log).toHaveBeenCalled();
  });
});
