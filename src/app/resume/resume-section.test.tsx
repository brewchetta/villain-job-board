// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./resume-preview", () => ({
  ResumePreview: ({ ext, version }: { ext: string; version: number }) => (
    <div data-testid="preview">{`${ext} v${version}`}</div>
  ),
}));

vi.mock("./forms", () => ({
  RemoveResumeButton: () => <button type="button">Remove resume</button>,
  ResumeUploadForm: ({ hasResume, onUploaded }: { hasResume: boolean; onUploaded?: () => void }) => (
    <button type="button" onClick={onUploaded}>
      {hasResume ? "replace" : "upload"}
    </button>
  ),
}));

import { ResumeSection } from "./resume-section";

describe("ResumeSection", () => {
  it("shows an empty state and only the upload form when there is no resume", () => {
    render(<ResumeSection ext={null} />);

    expect(screen.getByText("No resume on file yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove resume" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "upload" })).toBeInTheDocument();
  });

  it("shows the preview, download link and remove button for an existing resume", () => {
    render(<ResumeSection ext="pdf" />);

    expect(screen.getByTestId("preview")).toHaveTextContent("pdf v0");
    expect(screen.getByRole("link", { name: "Download your current resume" })).toHaveAttribute(
      "href",
      "/account/resume",
    );
    expect(screen.getByRole("button", { name: "Remove resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "replace" })).toBeInTheDocument();
  });

  it("tells the preview to reload after each upload, even if the file type is unchanged", async () => {
    const user = userEvent.setup();
    render(<ResumeSection ext="docx" />);

    await user.click(screen.getByRole("button", { name: "replace" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("docx v1");

    await user.click(screen.getByRole("button", { name: "replace" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("docx v2");
  });
});
