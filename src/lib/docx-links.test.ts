// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeLinks } from "./docx-links";

function render(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  sanitizeLinks(root);
  return root;
}

const first = (root: HTMLElement) => root.querySelector("a")!;

describe("sanitizeLinks", () => {
  it.each(["https://example.com/me", "http://example.com", "mailto:ann@example.com"])(
    "keeps %s and opens it safely in a new tab",
    (href) => {
      const link = first(render(`<a href="${href}">x</a>`));

      expect(link.getAttribute("href")).toBe(href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    },
  );

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///C:/secrets.txt",
    "//evil.example/x",
    "/relative/path",
    "",
  ])("removes the href from %j", (href) => {
    const link = first(render(`<a href="${href}" target="_blank">x</a>`));

    expect(link).not.toHaveAttribute("href");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveTextContent("x");
  });

  it("leaves in-document anchors alone", () => {
    const link = first(render('<a href="#section-2">jump</a>'));

    expect(link.getAttribute("href")).toBe("#section-2");
    expect(link).not.toHaveAttribute("target");
  });

  it("handles several links and ignores anchors without an href", () => {
    const root = render(
      '<a href="https://ok.example">ok</a><a href="javascript:x()">bad</a><a name="n">plain</a>',
    );
    const [ok, bad, plain] = root.querySelectorAll("a");

    expect(ok).toHaveAttribute("href", "https://ok.example");
    expect(bad).not.toHaveAttribute("href");
    expect(plain).not.toHaveAttribute("target");
  });
});
