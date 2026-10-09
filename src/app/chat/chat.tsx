"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "@/lib/types";

const MAX_CHARS = 500; // Keep in sync with MAX_USER_CHARS in api/chat/route.ts.
const GENERIC_ERROR = "Something went wrong. Please try again.";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? GENERIC_ERROR);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      // Roll back to before this question so the user can just resend it.
      setMessages(messages);
      setInput(text);
      setError(err instanceof Error ? err.message : GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <section className="chat">
      <div className="chat-log" aria-live="polite">
        <p className="chat-message chat-assistant">
          Welcome to The Garden. What do you need to know about working here?
        </p>
        {messages.map((m, i) => (
          <p key={i} className={`chat-message chat-${m.role}`}>
            {m.content || (pending ? "Thinking…" : "")}
          </p>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <form className="chat-form" onSubmit={send}>
        <label className="chat-label" htmlFor="chat-input">
          Your question
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_CHARS}
          rows={2}
          placeholder="How much vacation do I get?"
        />
        <button type="submit" disabled={pending || !input.trim()}>
          {pending ? "Replying…" : "Send"}
        </button>
      </form>
    </section>
  );
}
