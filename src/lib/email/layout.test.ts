import { describe, expect, it } from "vitest";
import { button, card, emailLayout, escapeHtml, heading, normalizeSiteUrl } from "./layout";

describe("escapeHtml", () => {
  it("escapes the characters that can break out of HTML text or attributes", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });
});

describe("normalizeSiteUrl", () => {
  it("reduces a URL to its origin", () => {
    expect(normalizeSiteUrl("https://garden.example/some/path/?q=1")).toBe("https://garden.example");
    expect(normalizeSiteUrl(" http://localhost:3000/ ")).toBe("http://localhost:3000");
  });

  it("rejects a missing, malformed or non-http(s) value", () => {
    expect(normalizeSiteUrl(undefined)).toBeUndefined();
    expect(normalizeSiteUrl("")).toBeUndefined();
    expect(normalizeSiteUrl("not a url")).toBeUndefined();
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeSiteUrl("ftp://garden.example")).toBeUndefined();
  });
});

describe("building blocks", () => {
  it("escapes the text passed to heading, card and button", () => {
    expect(heading("<i>Hi</i>")).toContain("&lt;i&gt;Hi&lt;/i&gt;");
    expect(card({ label: "L", title: "<b>T</b>", note: "n&n" })).toContain("&lt;b&gt;T&lt;/b&gt;");
    expect(button({ label: "Go", href: 'https://x.example/"onmouseover="y' })).not.toContain('"onmouseover="y');
  });

  it("leaves out the card note when none is given", () => {
    expect(card({ label: "L", title: "T" })).not.toContain("font-size:14px");
  });
});

describe("emailLayout", () => {
  const html = emailLayout({ title: "Hello", body: "<p>Body</p>", footer: "Footer & more" });

  it("wraps the body in the shared header and footer", () => {
    expect(html).toContain("The Garden");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("Footer &amp; more");
    expect(html).toContain("<title>Hello</title>");
  });

  it("only includes the logo when a site URL is given", () => {
    expect(html).not.toContain("<img");
    expect(emailLayout({ title: "t", body: "", footer: "", siteUrl: "https://garden.example" })).toContain(
      'src="https://garden.example/logo.png"',
    );
  });
});
