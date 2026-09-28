"use client";

import { useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/schemas";

interface ChatThreadProps {
  messages: ChatMessage[];
  status: "idle" | "loading" | "streaming" | "done" | "error";
  error?: string | null;
  placeholder: string;
  onSend: (message: string) => void;
  onRetry?: () => void;
}

export function ChatThread({ messages, status, error, placeholder, onSend, onRetry }: ChatThreadProps) {
  const [draft, setDraft] = useState("");
  const busy = status === "streaming" || status === "loading";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1" data-testid="chat-messages">
        {messages.length === 0 && <p className="text-sm text-slate-400">Ask a question to get started.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.content || ((status === "streaming" || status === "loading") && i === messages.length - 1 ? (
                <span data-testid="streaming-cursor" className="inline-block h-3 w-1.5 animate-pulse bg-slate-400 align-middle" />
              ) : null)}
            </div>
          </div>
        ))}
        {status === "error" && (
          <div data-testid="answer-error" className="space-y-2 rounded-lg bg-red-50 p-3">
            <p className="text-sm text-red-700">{error ?? "Something went wrong."}</p>
            {onRetry && (
              <button
                type="button"
                data-testid="retry-button"
                onClick={onRetry}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 pt-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
