// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/dynamic becomes a plain React.lazy so the mocked viewers load like the
// real ones would, without pdf.js or docx-preview.
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<{ default: React.ComponentType<object> }>) => {
      const Lazy = React.lazy(loader);
      return (props: object) => (
        <React.Suspense fallback={null}>
          <Lazy {...props} />
        </React.Suspense>
      );
    },
  };
});

vi.mock("./pdf-viewer", () => ({
  default: ({ mode, url }: { mode: string; url: string }) => (
    <div data-testid="pdf-viewer" data-mode={mode} data-url={url} />
  ),
}));
vi.mock("./docx-viewer", () => ({
  default: ({ mode }: { mode: string }) => <div data-testid="docx-viewer" data-mode={mode} />,
}));

import { ResumePreview } from "./resume-preview";

const fetchMock = vi.fn();

function respondWithFile() {
  fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(["file"]) });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  respondWithFile();

  // jsdom has no object URLs; hand out a distinct one per call.
  let urlCount = 0;
  URL.createObjectURL = vi.fn(() => `blob:resume-${++urlCount}`);
  URL.revokeObjectURL = vi.fn();

  // jsdom does not implement the dialog methods.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

const thumbnail = () => screen.findByRole("button", { name: "Enlarge resume preview" });

describe("ResumePreview", () => {
  it("shows a loading message, then the PDF thumbnail", async () => {
    render(<ResumePreview ext="pdf" version={0} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading preview");

    const button = await thumbnail();
    expect(button).toContainElement(await screen.findByTestId("pdf-viewer"));
    expect(screen.getByTestId("pdf-viewer")).toHaveAttribute("data-mode", "thumb");
    expect(screen.queryByTestId("docx-viewer")).not.toBeInTheDocument();
  });

  it("uses the DOCX viewer for a docx resume", async () => {
    render(<ResumePreview ext="docx" version={0} />);

    await thumbnail();
    expect(await screen.findByTestId("docx-viewer")).toHaveAttribute("data-mode", "thumb");
    expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
  });

  it("fetches the file through the signed-link route, uncached", async () => {
    render(<ResumePreview ext="pdf" version={0} />);
    await thumbnail();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/account/resume");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("opens a modal with the full viewer when the thumbnail is clicked, without refetching", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);
    const button = await thumbnail();

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");
    expect(await screen.findAllByTestId("pdf-viewer")).toHaveLength(1);

    await user.click(button);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveAttribute("open");
    const viewers = await screen.findAllByTestId("pdf-viewer");
    expect(viewers.map((viewer) => viewer.getAttribute("data-mode")).sort()).toEqual(["full", "thumb"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("offers a download link in the modal", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);

    await user.click(await thumbnail());

    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/account/resume");
  });

  it("closes from the Close button and unmounts the full viewer", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);
    await user.click(await thumbnail());

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
    expect(screen.getAllByTestId("pdf-viewer")).toHaveLength(1);
  });

  it("closes when the backdrop (the dialog itself) is clicked, but not when the content is", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);
    await user.click(await thumbnail());
    const dialog = screen.getByRole("dialog");

    await user.click(screen.getByText("Your resume"));
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();

    await user.click(dialog);
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
  });

  it("treats Esc (the dialog's close event) as closing", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);
    await user.click(await thumbnail());
    expect(await screen.findAllByTestId("pdf-viewer")).toHaveLength(2);

    act(() => {
      screen.getByRole("dialog").dispatchEvent(new Event("close"));
    });

    await waitFor(() => expect(screen.getAllByTestId("pdf-viewer")).toHaveLength(1));
  });

  it("fetches again when the version changes, showing loading rather than the old file", async () => {
    const { rerender } = render(<ResumePreview ext="pdf" version={0} />);
    await thumbnail();

    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    rerender(<ResumePreview ext="pdf" version={1} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading preview");
    expect(screen.queryByRole("button", { name: "Enlarge resume preview" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    finish({ ok: true, blob: async () => new Blob(["new"]) });
    await thumbnail();
  });

  it("fetches again when the file type changes", async () => {
    const { rerender } = render(<ResumePreview ext="pdf" version={0} />);
    await thumbnail();

    rerender(<ResumePreview ext="docx" version={0} />);

    expect(await screen.findByTestId("docx-viewer")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains a failed download and offers no thumbnail", async () => {
    fetchMock.mockResolvedValue({ ok: false, blob: async () => new Blob() });
    render(<ResumePreview ext="pdf" version={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load a preview");
    expect(screen.queryByRole("button", { name: "Enlarge resume preview" })).not.toBeInTheDocument();
  });

  it("explains a network failure too", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ResumePreview ext="pdf" version={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load a preview");
  });

  it("gives the PDF viewer one blob URL, shared by the thumbnail and the modal", async () => {
    const user = userEvent.setup();
    render(<ResumePreview ext="pdf" version={0} />);

    await user.click(await thumbnail());

    const urls = (await screen.findAllByTestId("pdf-viewer")).map((viewer) => viewer.getAttribute("data-url"));
    expect(urls).toEqual(["blob:resume-1", "blob:resume-1"]);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes the blob URL when the version changes and when unmounted", async () => {
    const { rerender, unmount } = render(<ResumePreview ext="pdf" version={0} />);
    await thumbnail();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    rerender(<ResumePreview ext="pdf" version={1} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:resume-1");

    await thumbnail();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:resume-2");
  });

  it("does not create a blob URL for a request that was cancelled before it finished", async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const { unmount } = render(<ResumePreview ext="pdf" version={0} />);
    unmount();
    finish({ ok: true, blob: async () => new Blob(["late"]) });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("aborts the request when unmounted, without reporting an error", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {});
    });

    const { unmount } = render(<ResumePreview ext="pdf" version={0} />);
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
