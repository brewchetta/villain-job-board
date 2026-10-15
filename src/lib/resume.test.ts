import { describe, expect, it } from "vitest";
import { isResumeExt, resumeExtension, resumePath } from "./resume";

describe("resumeExtension", () => {
  it("accepts pdf and docx in any case", () => {
    expect(resumeExtension("cv.pdf")).toBe("pdf");
    expect(resumeExtension("My Resume.DOCX")).toBe("docx");
    expect(resumeExtension("a.b.c.PdF")).toBe("pdf");
  });

  it("rejects everything else", () => {
    expect(resumeExtension("cv.doc")).toBeNull();
    expect(resumeExtension("cv.exe")).toBeNull();
    expect(resumeExtension("pdf")).toBe("pdf"); // a bare name with no dot is its own "extension"
    expect(resumeExtension("")).toBeNull();
    expect(resumeExtension("cv.pdf.exe")).toBeNull();
  });
});

describe("isResumeExt", () => {
  it("only accepts our own keys, not inherited object properties", () => {
    expect(isResumeExt("pdf")).toBe(true);
    expect(isResumeExt("docx")).toBe(true);
    expect(isResumeExt("toString")).toBe(false);
    expect(isResumeExt("__proto__")).toBe(false);
    expect(isResumeExt(undefined)).toBe(false);
  });
});

describe("resumePath", () => {
  it("puts the file in the user's own folder", () => {
    expect(resumePath("u1", "pdf")).toBe("u1/resume.pdf");
    expect(resumePath("u1", "docx")).toBe("u1/resume.docx");
  });
});
