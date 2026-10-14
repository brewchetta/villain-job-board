import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { sendNewsletter } from "@/lib/email/newsletter";

// Constant-time comparison so the secret can't be guessed byte by byte.
function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Called by a scheduler (GitHub Actions while testing, Vercel Cron for the
// monthly send) with `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET
// set, every request is refused.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(await sendNewsletter());
}
