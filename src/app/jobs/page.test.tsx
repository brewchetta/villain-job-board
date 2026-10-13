// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJob, makeJobs } from "@/test/fixtures";

const { getJobs } = vi.hoisted(() => ({ getJobs: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ getJobs }));

import JobsPage, { metadata } from "./page";

// Matches PAGE_SIZE in page.tsx.
const PAGE_SIZE = 10;
const Page = JobsPage;

// JobsPage is an async Server Component: await it, then render the result.
async function renderPage(page?: string) {
  render(await Page({ searchParams: Promise.resolve(page === undefined ? {} : { page }) }));
}

const titles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const roles = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `Villain Role ${from + i}`);

beforeEach(() => {
  getJobs.mockReset();
});

describe("Open positions page", () => {
  it("has its own page title", () => {
    expect(metadata.title).toBe("Open Positions | The Garden");
  });

  describe("with a few positions", () => {
    beforeEach(() => {
      getJobs.mockResolvedValue([
        makeJob({ id: "henchperson", title: "Henchperson", summary: "Stand menacingly." }),
        makeJob({ id: "mad-scientist", title: "Mad Scientist", summary: "Invent unlikely contraptions." }),
        makeJob({ id: "minion-wrangler", title: "Minion Wrangler", summary: "Coordinate snacks and morale." }),
      ]);
    });

    it("shows the page heading", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { level: 1, name: "Open Positions" })).toBeInTheDocument();
    });

    it("lists each position with its title and summary", async () => {
      await renderPage();

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(within(items[0]).getByRole("heading", { level: 2, name: "Henchperson" })).toBeInTheDocument();
      expect(within(items[0]).getByText("Stand menacingly.")).toBeInTheDocument();
      expect(within(items[1]).getByText("Invent unlikely contraptions.")).toBeInTheDocument();
    });

    it("links each title to its own job page", async () => {
      await renderPage();

      expect(screen.getByRole("link", { name: "Henchperson" })).toHaveAttribute("href", "/jobs/henchperson");
      expect(screen.getByRole("link", { name: "Mad Scientist" })).toHaveAttribute("href", "/jobs/mad-scientist");
      expect(screen.getByRole("link", { name: "Minion Wrangler" })).toHaveAttribute("href", "/jobs/minion-wrangler");
    });

    it("keeps the order the data layer returns", async () => {
      await renderPage();
      expect(titles()).toEqual(["Henchperson", "Mad Scientist", "Minion Wrangler"]);
    });
  });

  describe("with exactly one position", () => {
    it("renders a single entry", async () => {
      getJobs.mockResolvedValue([makeJob()]);
      await renderPage();

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
  });

  describe("with no positions", () => {
    beforeEach(() => getJobs.mockResolvedValue([]));

    it("still renders the page heading and no job entries without crashing", async () => {
      await renderPage();

      expect(screen.getByRole("heading", { level: 1, name: "Open Positions" })).toBeInTheDocument();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/jobs/"))).toHaveLength(0);
    });

    it("doesn't show pagination controls when there is nothing to page through", async () => {
      await renderPage();

      expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
    });
  });

  describe("with unusual content", () => {
    it("renders HTML in a title as plain text, not markup", async () => {
      getJobs.mockResolvedValue([makeJob({ id: "x", title: "<script>alert(1)</script>Villain", summary: "<b>bold</b>" })]);
      await renderPage();

      expect(screen.getByRole("link", { name: "<script>alert(1)</script>Villain" })).toBeInTheDocument();
      expect(document.querySelector("script")).toBeNull();
      expect(document.querySelector("b")).toBeNull();
    });

    it("renders a position with a very long title and summary", async () => {
      const title = "Chief ".repeat(100).trim();
      const summary = "Menace ".repeat(300).trim();
      getJobs.mockResolvedValue([makeJob({ title, summary })]);
      await renderPage();

      expect(screen.getByRole("link", { name: title })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    });
  });

  it("lets a data error propagate so Next can show its error boundary", async () => {
    getJobs.mockRejectedValue(new Error("Failed to load jobs: boom"));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Failed to load jobs: boom");
  });
});

describe("empty state on the open positions page", () => {
  beforeEach(() => getJobs.mockResolvedValue([]));

  it("tells the visitor there are no open positions right now", async () => {
    await renderPage();

    expect(screen.getByText(/no open positions/i)).toBeInTheDocument();
  });

  it("points the visitor somewhere useful instead of a dead end", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /home|back|check back/i })).toBeInTheDocument();
  });
});

describe("pagination on the open positions page", () => {
  describe("with 250 positions", () => {
    beforeEach(() => getJobs.mockResolvedValue(makeJobs(250)));

    it(`shows only the first ${PAGE_SIZE} positions on page 1`, async () => {
      await renderPage();

      expect(titles()).toEqual(roles(1, PAGE_SIZE));
      expect(screen.getAllByRole("listitem")).toHaveLength(PAGE_SIZE);
    });

    it("tells the visitor which page they are on", async () => {
      await renderPage();

      expect(screen.getByText(/page 1 of 25/i)).toBeInTheDocument();
    });

    it("offers a Next link on page 1 but no Previous link", async () => {
      await renderPage();

      expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/jobs?page=2");
      expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
    });

    it("wraps the controls in a labelled pagination landmark", async () => {
      await renderPage();

      expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
    });

    it("shows positions 11 to 20 on ?page=2", async () => {
      await renderPage("2");

      expect(titles()).toEqual(roles(11, 20));
      expect(screen.getByText(/page 2 of 25/i)).toBeInTheDocument();
    });

    it("offers both Previous and Next on a middle page", async () => {
      await renderPage("2");

      expect(screen.getByRole("link", { name: /previous/i }).getAttribute("href")).toMatch(/^\/jobs(\?page=1)?$/);
      expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/jobs?page=3");
    });

    it("still links each position on a later page to its own job", async () => {
      await renderPage("3");

      expect(screen.getByRole("link", { name: "Villain Role 21" })).toHaveAttribute("href", "/jobs/job-21");
    });

    it("shows the last page with no Next link", async () => {
      await renderPage("25");

      expect(titles()).toEqual(roles(241, 250));
      expect(screen.queryByRole("link", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/jobs?page=24");
    });

    it("shows the last page for a page number past the end instead of a blank page", async () => {
      await renderPage("999");

      expect(titles()).toEqual(roles(241, 250));
    });

    it.each(["abc", "0", "-3", "1.5", ""])("treats ?page=%j as page 1", async (value) => {
      await renderPage(value);

      expect(titles()).toEqual(roles(1, PAGE_SIZE));
    });
  });

  describe("when the last page is only partly full", () => {
    beforeEach(() => getJobs.mockResolvedValue(makeJobs(25)));

    it("shows just the leftover positions on the last page", async () => {
      await renderPage("3");

      expect(titles()).toEqual(roles(21, 25));
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
    });
  });

  describe("when every position fits on one page", () => {
    it("shows page 1 of 1 and no Next or Previous links", async () => {
      getJobs.mockResolvedValue(makeJobs(PAGE_SIZE));
      await renderPage();

      expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /next|previous/i })).not.toBeInTheDocument();
    });
  });
});
