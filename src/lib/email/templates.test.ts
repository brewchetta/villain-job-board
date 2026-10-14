import { describe, expect, it } from "vitest";
import { greetingName, hiredEmail } from "./templates";

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

  it("is plain text only for now", () => {
    expect(email.html).toBeUndefined();
  });
});
