import { chooseModel, describeError, streamHrAnswer } from "@/lib/chat";
import { HR_FALLBACK_MESSAGE } from "@/lib/hr-contact";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 30;

const MAX_BODY_CHARS = 20_000;
const MAX_TURNS = 10;
const MAX_USER_CHARS = 500;
const MAX_ASSISTANT_CHARS = 4_000;

// Public endpoint: validate everything, trust nothing from the client.
function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_TURNS)) {
    const { role, content } = (item ?? {}) as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    const max = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!text || text.length > max) return null;
    messages.push({ role, content: text });
  }

  // The API needs the conversation to start with, and end on, a user turn.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export async function POST(request: Request) {
  // Only trustworthy behind a proxy that sets x-forwarded-for; the daily cap backstops spoofing.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return Response.json(
      { error: "You're asking too fast. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const raw = await request.text();
  let messages: ChatMessage[] | null = null;
  if (raw.length <= MAX_BODY_CHARS) {
    try {
      messages = parseMessages(JSON.parse(raw));
    } catch {
      // Falls through to the 400 below.
    }
  }
  if (!messages) {
    return Response.json(
      { error: `Send up to ${MAX_TURNS} messages ending with yours, each under ${MAX_USER_CHARS} characters.` },
      { status: 400 },
    );
  }

  // Pull the first chunk before replying so setup failures (missing key, docs or
  // API unreachable) can still return a real HTTP error instead of a broken stream.
  const model = await chooseModel(messages);
  console.log(`HR chat routed to ${model}`);
  const answer = streamHrAnswer(messages, model);
  let first: IteratorResult<string>;
  try {
    first = await answer.next();
  } catch (err) {
    console.error("HR chat failed:", describeError(err));
    return Response.json({ error: HR_FALLBACK_MESSAGE }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let step = first;
        while (!step.done) {
          controller.enqueue(encoder.encode(step.value));
          step = await answer.next();
        }
      } catch (err) {
        // Headers are already sent, so finish the message with a way forward.
        console.error("HR chat stream failed:", describeError(err));
        controller.enqueue(encoder.encode(`\n\n${HR_FALLBACK_MESSAGE}`));
      }
      controller.close();
    },
    async cancel() {
      await answer.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
      // Which model answered; handy when tuning the routing.
      "X-HR-Model": model,
    },
  });
}
