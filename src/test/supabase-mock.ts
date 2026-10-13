import { vi } from "vitest";

type Result = { data?: unknown; error?: unknown };

// A chainable, awaitable stand-in for a Supabase query builder. Every chain
// method returns the builder and records its arguments; awaiting it (or calling
// maybeSingle) resolves to `result`.
export function createQueryBuilder(result: Result = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  const chain = ["select", "update", "order", "eq"] as const;

  for (const name of chain) builder[name] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return builder as Record<(typeof chain)[number], ReturnType<typeof vi.fn>> &
    Record<"maybeSingle", ReturnType<typeof vi.fn>>;
}
