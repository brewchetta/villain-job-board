import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/lib/email/client", () => ({ sendEmail: mocks.sendEmail }));

import { GET } from "./route";

const SECRET = "s3cret-value-1234";

function request(authorization?: string) {
  return {
    headers: new Headers(authorization ? { authorization } : {}),
  } as never;
}

beforeEach(() => {
  mocks.sendEmail.mockReset();
  mocks.sendEmail.mockResolvedValue({ ok: true });
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "me@example.com");
});

describe("GET /api/cron/newsletter", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer nope"],
    ["a secret of a different length", `Bearer ${SECRET}x`],
    ["a missing Bearer prefix", SECRET],
  ])("refuses %s without sending", async (_name, header) => {
    const response = await GET(request(header));

    expect(response.status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses everything when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await GET(request("Bearer "))).status).toBe(401);
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends the newsletter and reports counts for the right secret", async () => {
    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sent: 1, failed: 0 });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe("me@example.com");
  });
});
