"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "@/lib/types";

const MAX_CHARS = 500; // Keep in sync with MAX_USER_CHARS in api/chat/route.ts.
const GENERIC_ERROR = "Something went wrong. Please try again.";

// Lives in the root layout, so the conversation survives navigation between pages.
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Scroll the log itself, not the page.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open, expanded]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

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

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!open) {
    return (
      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        aria-expanded={false}
        aria-controls="chat-panel"
        onClick={() => setOpen(true)}
      >
        Ask HR
      </button>
    );
  }

  return (
    <section
      id="chat-panel"
      className={`chat-panel${expanded ? " chat-panel-expanded" : ""}`}
      aria-label="HR chat"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <header className="chat-header">
        <strong>HR Chat</strong>
        <div className="chat-header-actions">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Shrink chat window" : "Enlarge chat window"}
            title={expanded ? "Shrink" : "Enlarge"}
          >
            {expanded ? "⤡" : "⤢"}
          </button>
          <button type="button" onClick={close} aria-label="Close chat" title="Close">
            ✕
          </button>
        </div>
      </header>

      <div className="chat-log" ref={logRef} aria-live="polite">
        <p className="chat-message chat-assistant">
          Welcome to The Garden. What do you need to know about working here? I&apos;m an AI
          assistant, so for anything official, talk to a human.
        </p>
        {messages.map((m, i) => (
          <p key={i} className={`chat-message chat-${m.role}`}>
            {m.content || (pending ? "Thinking…" : "")}
          </p>
        ))}
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
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
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
