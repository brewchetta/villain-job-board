import { afterEach } from "vitest";

// Only component tests (jsdom) need the DOM matchers and automatic cleanup.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
