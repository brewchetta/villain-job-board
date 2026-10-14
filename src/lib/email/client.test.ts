import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), Resend: vi.fn() }));

vi.mock("resend", () => ({ Resend: mocks.Resend }));

import { sendEmail } from "./client";

const message = { to: "a@b.co", subject: "Hi", text: "Hello" };

beforeEach(() => {
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: "e1" }, error: null });
  mocks.Resend.mockReset();
  mocks.Resend.mockImplementation(function () {
    return { emails: { send: mocks.send } };
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "");
});

afterEach(() => vi.restoreAllMocks());

describe("sendEmail", () => {
  it("sends plain text from the default sandbox sender", async () => {
    await expect(sendEmail(message)).resolves.toEqual({ ok: true });

    expect(mocks.Resend).toHaveBeenCalledWith("re_test");
    expect(mocks.send).toHaveBeenCalledWith({
      from: "The Garden <onboarding@resend.dev>",
      to: "a@b.co",
      subject: "Hi",
      text: "Hello",
    });
  });

  it("uses EMAIL_FROM and passes html along when a template provides it", async () => {
    vi.stubEnv("EMAIL_FROM", "Garden HR <hr@example.com>");

    await sendEmail({ ...message, html: "<p>Hello</p>" });

    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      from: "Garden HR <hr@example.com>",
      html: "<p>Hello</p>",
    });
  });

  it("does not throw or call the provider when the API key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(sendEmail(message)).resolves.toEqual({ ok: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reports failure without leaking the recipient when the provider returns an error", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad to: a@b.co" } });

    await expect(sendEmail(message)).resolves.toEqual({ ok: false });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("a@b.co");
  });

  it("reports failure when the request itself throws", async () => {
    mocks.send.mockRejectedValue(new Error("network down for a@b.co"));

    await expect(sendEmail(message)).resolves.toEqual({ ok: false });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("a@b.co");
  });
});
