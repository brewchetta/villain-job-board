import "server-only";

// In-memory limits for the public chat endpoint: a per-IP sliding window plus a
// global daily cap that bounds Anthropic spend no matter how many IPs show up.
// State lives in this server instance only, so on serverless/multi-instance
// hosting the limits are per instance (swap in a shared store, e.g. a Supabase
// counter table, if that matters).
const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 10;
const DAILY_LIMIT = 500;

const hitsByIp = new Map<string, number[]>();
let daily = { day: "", count: 0 };

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();

  const day = new Date(now).toISOString().slice(0, 10);
  if (daily.day !== day) daily = { day, count: 0 };
  if (daily.count >= DAILY_LIMIT) {
    const tomorrow = Date.parse(day) + 24 * 60 * 60 * 1000;
    return { ok: false, retryAfterSeconds: Math.ceil((tomorrow - now) / 1000) };
  }

  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP_LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }

  recent.push(now);
  hitsByIp.set(ip, recent);
  daily.count++;

  // Keep the map from growing without bound.
  if (hitsByIp.size > 5000) {
    for (const [key, times] of hitsByIp) {
      if (times.every((t) => now - t >= WINDOW_MS)) hitsByIp.delete(key);
    }
  }
  return { ok: true };
}
