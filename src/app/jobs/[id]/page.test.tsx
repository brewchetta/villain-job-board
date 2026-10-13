// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJob, makeJobs } from "@/test/fixtures";

const { getJobById, getJobs, notFound } = vi.hoisted(() => ({
  getJobById: vi.fn(),
  getJobs: vi.fn(),
  notFound: vi.fn(() => {
    // Real notFound() throws to stop rendering.
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/jobs", () => ({ getJobById, getJobs }));
vi.mock("next/navigation", () => ({ notFound }));
// ApplySection reads the session and is tested on its own; here it is a stand-in
// that shows which job it was given.
vi.mock("./apply-section", () => ({
  ApplySection: ({ jobId }: { jobId: string }) => <div data-testid="apply-section">apply for {jobId}</div>,
}));

import JobPage, { generateStaticParams } from "./page";

async function renderJob(id = "henchperson") {
  render(await JobPage({ params: Promise.resolve({ id }) }));
}

const section = (heading: string) => screen.getByRole("heading", { level: 2, name: heading }).closest("section")!;

beforeEach(() => {
  getJobById.mockReset();
  getJobs.mockReset();
  notFound.mockClear();
  getJobById.mockResolvedValue(makeJob());
});

describe("Job position page", () => {
  it("looks the job up by the id in the URL", async () => {
    await renderJob("mad-scientist");
    expect(getJobById).toHaveBeenCalledWith("mad-scientist");
  });

  it("shows the title as the single h1, followed by the summary", async () => {
    await renderJob();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Henchperson" })).toBeInTheDocument();
    expect(screen.getByText("Stand menacingly in corridors and never ask what is in the crates.")).toBeInTheDocument();
  });

  it("links back to all positions", async () => {
    await renderJob();
    expect(screen.getByRole("link", { name: /All positions/ })).toHaveAttribute("href", "/jobs");
  });

  it("shows the location and the pay", async () => {
    await renderJob();

    expect(within(section("Location")).getByText("Various secret bases (assigned on first day)")).toBeInTheDocument();
    expect(within(section("Pay")).getByText("$38,000 - $48,000 per year, plus combat pay")).toBeInTheDocument();
  });

  it("lists every qualification, benefit and disclaimer under its own heading", async () => {
    await renderJob();

    const qualifications = within(section("Qualifications")).getAllByRole("listitem");
    expect(qualifications.map((li) => li.textContent)).toEqual([
      "Comfortable standing for long periods",
      "Able to follow orders",
    ]);
    const benefits = within(section("Benefits")).getAllByRole("listitem");
    expect(benefits.map((li) => li.textContent)).toEqual([
      "Dental (replacement teeth included)",
      "Matching uniform allowance",
    ]);
    const disclaimers = within(section("Disclaimers")).getAllByRole("listitem");
    expect(disclaimers.map((li) => li.textContent)).toEqual([
      "Not liable for injuries caused by heroes, lasers, or sharks.",
    ]);
  });

  it("does not mix content between sections", async () => {
    await renderJob();

    expect(within(section("Qualifications")).queryByText(/Dental/)).not.toBeInTheDocument();
    expect(within(section("Benefits")).queryByText(/Able to follow orders/)).not.toBeInTheDocument();
    expect(within(section("Disclaimers")).queryByText(/Matching uniform/)).not.toBeInTheDocument();
  });

  it("shows the sections in a sensible order, ending with Apply", async () => {
    await renderJob();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Location", "Pay", "Qualifications", "Benefits", "Disclaimers", "Apply"]);
  });

  it("hands the job's id to the Apply section", async () => {
    await renderJob("henchperson");
    expect(within(section("Apply")).getByTestId("apply-section")).toHaveTextContent("apply for henchperson");
  });

  describe("unknown job", () => {
    it("calls notFound() when there is no such job", async () => {
      getJobById.mockResolvedValue(undefined);

      await expect(JobPage({ params: Promise.resolve({ id: "does-not-exist" }) })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(1);
    });

    it("does not call notFound() for a job that exists", async () => {
      await renderJob();
      expect(notFound).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("keeps the headings but shows empty lists when a job has no benefits, qualifications or disclaimers", async () => {
      getJobById.mockResolvedValue(makeJob({ benefits: [], qualifications: [], disclaimers: [] }));
      await renderJob();

      for (const heading of ["Qualifications", "Benefits", "Disclaimers"]) {
        expect(within(section(heading)).queryAllByRole("listitem")).toHaveLength(0);
      }
      expect(screen.getByRole("heading", { level: 1, name: "Henchperson" })).toBeInTheDocument();
    });

    it("renders long lists in full", async () => {
      const benefits = Array.from({ length: 40 }, (_, i) => `Benefit ${i + 1}`);
      getJobById.mockResolvedValue(makeJob({ benefits }));
      await renderJob();

      expect(within(section("Benefits")).getAllByRole("listitem")).toHaveLength(40);
    });

    it("renders HTML in job content as plain text, not markup", async () => {
      getJobById.mockResolvedValue(
        makeJob({ title: "<img src=x onerror=alert(1)>", pay: "<b>$1</b>", benefits: ["<script>x</script>"] }),
      );
      await renderJob();

      expect(document.querySelector("img")).toBeNull();
      expect(document.querySelector("b")).toBeNull();
      expect(document.querySelector("script")).toBeNull();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("<img src=x onerror=alert(1)>");
    });

    it("lets a data error propagate", async () => {
      getJobById.mockRejectedValue(new Error("Failed to load job: boom"));
      await expect(JobPage({ params: Promise.resolve({ id: "x" }) })).rejects.toThrow("Failed to load job: boom");
    });
  });
});

describe("generateStaticParams", () => {
  it("returns one { id } per job so every job page can be prerendered", async () => {
    getJobs.mockResolvedValue(makeJobs(3));

    await expect(generateStaticParams()).resolves.toEqual([{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }]);
  });

  it("returns an empty list when there are no jobs", async () => {
    getJobs.mockResolvedValue([]);
    await expect(generateStaticParams()).resolves.toEqual([]);
  });
});
