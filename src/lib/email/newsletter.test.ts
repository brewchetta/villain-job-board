import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("./client", () => ({ sendEmail: mocks.sendEmail }));

import { getNewsletterRecipients, sendNewsletter } from "./newsletter";

beforeEach(() => {
  mocks.sendEmail.mockReset();
  mocks.sendEmail.mockResolvedValue({ ok: true });
  vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "me@example.com");
  vi.stubEnv("SITE_URL", "");
});

describe("getNewsletterRecipients", () => {
  it("returns only the test recipient", () => {
    expect(getNewsletterRecipients()).toEqual(["me@example.com"]);
  });

  it("trims the address", () => {
    vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "  me@example.com  ");
    expect(getNewsletterRecipients()).toEqual(["me@example.com"]);
  });

  it("returns nobody when the variable is unset or blank", () => {
    vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "");
    expect(getNewsletterRecipients()).toEqual([]);
    vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "   ");
    expect(getNewsletterRecipients()).toEqual([]);
  });
});

describe("sendNewsletter", () => {
  it("sends the styled newsletter to the test recipient", async () => {
    vi.stubEnv("SITE_URL", "https://garden.example");

    await expect(sendNewsletter()).resolves.toEqual({ sent: 1, failed: 0 });

    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email.to).toBe("me@example.com");
    expect(email.subject).toBe("What does evil mean to you?");
    expect(email.html).toContain('href="https://garden.example/jobs"');
  });

  it("sends nothing, and says so, when there is no recipient", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEWSLETTER_TEST_RECIPIENT", "");

    await expect(sendNewsletter()).resolves.toEqual({ sent: 0, failed: 0 });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("counts a failed send instead of throwing", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false });

    await expect(sendNewsletter()).resolves.toEqual({ sent: 0, failed: 1 });
  });
});
