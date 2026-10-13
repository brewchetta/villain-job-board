import path from "node:path";
import { defineConfig } from "vitest/config";

// Logic tests (*.test.ts) run in plain Node. Component tests (*.test.tsx) opt in
// to jsdom with a `// @vitest-environment jsdom` docblock. Async Server
// Components can't be rendered by React in a test, so those tests `await` the
// component function and render the element it returns. Next and Supabase
// boundaries are mocked.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" throws outside a React Server environment.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
