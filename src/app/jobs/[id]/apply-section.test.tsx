// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationStatus } from "@/lib/types";

const { getSessionUser, getMyApplicationForJob } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getMyApplicationForJob: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/applications", () => ({ getMyApplicationForJob }));
// The real server actions are exercised in applications/apply-flow.test.tsx.
vi.mock("../../applications/actions", () => ({ applyToJob: vi.fn(), withdrawApplication: vi.fn() }));

import { ApplySection } from "./apply-section";

// ApplySection is an async Server Component: await it, then render the result.
async function renderSection(jobId = "henchperson") {
  render(await ApplySection({ jobId }));
}

beforeEach(() => {
  getSessionUser.mockReset();
  getMyApplicationForJob.mockReset();
});

describe("ApplySection: signed out", () => {
  beforeEach(() => getSessionUser.mockResolvedValue(null));

  it("invites the visitor to log in or join instead of showing a form", async () => {
    await renderSection();

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "join The Garden" })).toHaveAttribute("href", "/signup");
    expect(screen.getByText(/to apply for this position/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply now" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Referral code/)).not.toBeInTheDocument();
  });

  it("doesn't look up an application for a visitor with no session", async () => {
    await renderSection();
    expect(getMyApplicationForJob).not.toHaveBeenCalled();
  });
});

describe("ApplySection: signed in, not yet applied", () => {
  beforeEach(() => {
    getSessionUser.mockResolvedValue({ id: "u1", email: "ada@garden.test" });
    getMyApplicationForJob.mockResolvedValue(null);
  });

  it("looks up this user's application for this job", async () => {
    await renderSection("mad-scientist");
    expect(getMyApplicationForJob).toHaveBeenCalledWith("u1", "mad-scientist");
  });

  it("shows the application form with a referral code field", async () => {
    await renderSection();

    expect(screen.getByLabelText(/Referral code/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply now" })).toBeEnabled();
    expect(screen.queryByText(/You applied/)).not.toBeInTheDocument();
  });

  it("targets the form at this job", async () => {
    await renderSection("mad-scientist");
    expect(document.querySelector('input[name="job_id"]')).toHaveValue("mad-scientist");
  });
});

describe("ApplySection: signed in, already applied", () => {
  beforeEach(() => getSessionUser.mockResolvedValue({ id: "u1", email: "ada@garden.test" }));

  it.each<ApplicationStatus>(["submitted", "reviewing", "interviewing", "offered", "rejected"])(
    "shows the %s status instead of the form",
    async (status) => {
      getMyApplicationForJob.mockResolvedValue({ id: "a1", status });
      await renderSection();

      expect(screen.getByText(status)).toHaveClass("status");
      expect(screen.getByText(/You applied for this position/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply now" })).not.toBeInTheDocument();
    },
  );

  it("links to the account page to see all applications", async () => {
    getMyApplicationForJob.mockResolvedValue({ id: "a1", status: "submitted" });
    await renderSection();

    expect(screen.getByRole("link", { name: "View your applications" })).toHaveAttribute("href", "/account");
  });

  it("shows the form again after the application was withdrawn, so the user can re-apply", async () => {
    getMyApplicationForJob.mockResolvedValue({ id: "a1", status: "withdrawn" });
    await renderSection();

    expect(screen.getByRole("button", { name: "Apply now" })).toBeInTheDocument();
    expect(screen.queryByText(/You applied/)).not.toBeInTheDocument();
  });

  it("lets a data error propagate", async () => {
    getMyApplicationForJob.mockRejectedValue(new Error("Failed to load application: boom"));
    await expect(ApplySection({ jobId: "x" })).rejects.toThrow("Failed to load application: boom");
  });
});
