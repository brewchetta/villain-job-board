import { describe, expect, it } from "vitest";
import { defaultIssue, greetingName, hiredEmail, newsletterEmail } from "./templates";

describe("greetingName", () => {
  it("prefers the evil nickname, then first name, then display name", () => {
    expect(greetingName({ evil_nickname: "Doom Spoon", first_name: "Ann", display_name: "AnnD" })).toBe("Doom Spoon");
    expect(greetingName({ evil_nickname: null, first_name: "Ann", display_name: "AnnD" })).toBe("Ann");
    expect(greetingName({ evil_nickname: null, first_name: null, display_name: "AnnD" })).toBe("AnnD");
  });

  it("ignores blank values and falls back to Henchman", () => {
    expect(greetingName({ evil_nickname: "  ", first_name: "", display_name: null })).toBe("Henchman");
    expect(greetingName(null)).toBe("Henchman");
  });
});

describe("hiredEmail", () => {
  const email = hiredEmail({ name: "Doom Spoon", jobTitle: "Henchperson" });

  it("puts the name in the subject and the name and job in the body", () => {
    expect(email.subject).toBe("You're hired, Doom Spoon");
    expect(email.text).toContain("Doom Spoon");
    expect(email.text).toContain("Henchperson");
  });

  it("has no logo or link without a site URL", () => {
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<a ");
    expect(email.text).not.toContain("http");
  });

  it("builds a styled HTML version with the name and job", () => {
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain("You&#39;re hired, Doom Spoon");
    expect(email.html).toContain("Henchperson");
    expect(email.html).toContain("#8b1020");
  });

  it("adds an account link in both versions when given a site URL", () => {
    const withSite = hiredEmail({ name: "Doom Spoon", jobTitle: "Henchperson", siteUrl: "https://garden.example" });

    expect(withSite.html).not.toContain("<img");
    expect(withSite.html).toContain('href="https://garden.example/account"');
    expect(withSite.text).toContain("https://garden.example/account");
  });

  it("escapes user-supplied text in the HTML but not in the plain text", () => {
    const sneaky = hiredEmail({ name: '<script>alert("x")</script>', jobTitle: "A & B <b>" });

    expect(sneaky.html).not.toContain("<script>");
    expect(sneaky.html).not.toContain("<b>");
    expect(sneaky.html).toContain("&lt;script&gt;");
    expect(sneaky.html).toContain("A &amp; B &lt;b&gt;");
    expect(sneaky.text).toContain('<script>alert("x")</script>');
  });
});

describe("newsletterEmail", () => {
  it("uses the newsletter name as the subject and this month's issue as the content", () => {
    const email = newsletterEmail();

    expect(email.subject).toBe("What does evil mean to you?");
    expect(email.text).toContain(defaultIssue.intro);
    expect(email.text).toContain(defaultIssue.quote);
    expect(email.text).toContain(defaultIssue.prompt);
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain(defaultIssue.intro);
    expect(email.html).toContain("#8b1020");
  });

  it("has no logo or link without a site URL", () => {
    const email = newsletterEmail();

    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<a ");
    expect(email.text).not.toContain("http");
  });

  it("adds a jobs link in both versions when given a site URL", () => {
    const email = newsletterEmail({ siteUrl: "https://garden.example" });

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain('href="https://garden.example/jobs"');
    expect(email.text).toContain("https://garden.example/jobs");
  });

  it("renders a different issue without changing the template", () => {
    const email = newsletterEmail({
      issue: { headline: "Month two", intro: "Intro two", quote: "Quote two", prompt: "Prompt two" },
    });

    expect(email.text).toContain("Month two");
    expect(email.html).toContain("Quote two");
    expect(email.html).not.toContain(defaultIssue.intro);
  });

  it("escapes issue text in the HTML but not in the plain text", () => {
    const email = newsletterEmail({
      issue: { headline: "<b>H</b>", intro: "A & B", quote: '<script>alert("x")</script>', prompt: "p" },
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>H</b>");
    expect(email.html).toContain("A &amp; B");
    expect(email.text).toContain('<script>alert("x")</script>');
  });
});
