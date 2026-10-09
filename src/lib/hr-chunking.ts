// Splits one HR doc into chunks for embedding. Pure, so it needs no Next.js or network.
//
// The docs use numbered section headings ("1. Paid Time Off") with short bodies, so
// each section is one chunk. The title block above section 1 is its own chunk. A
// section longer than MAX_CHUNK_CHARS is split by line, repeating its heading.
const MAX_CHUNK_CHARS = 1500;
const SECTION_START = /^\d+\.\s/;

function splitLongSection(lines: string[]): string[] {
  if (lines.join("\n").length <= MAX_CHUNK_CHARS) return [lines.join("\n")];

  const heading = SECTION_START.test(lines[0]) ? lines[0] : "";
  const body = heading ? lines.slice(1) : lines;
  const pieces: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) pieces.push([heading, ...current].filter(Boolean).join("\n"));
    current = [];
  };

  for (const line of body) {
    const size = heading.length + current.join("\n").length + line.length + 1;
    if (current.length && size > MAX_CHUNK_CHARS) flush();
    current.push(line);
  }
  flush();
  return pieces;
}

export function chunkDoc(text: string): string[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r\n?|\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  const sections: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (SECTION_START.test(line) && current.length) {
      sections.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) sections.push(current);

  return sections.flatMap(splitLongSection);
}
