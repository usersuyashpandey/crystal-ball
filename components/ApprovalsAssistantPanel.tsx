"use client";

import { useState, type FormEvent } from "react";
import { useAssistantStore, type AssistantView } from "@/lib/store";
import { ActionCard } from "./ActionCard";
import { StreamingAnswer } from "./StreamingAnswer";
import { ChatThread } from "./ChatThread";
import { UrgencyBadge } from "./UrgencyBadge";
import { ModeBadge } from "./ModeBadge";

const ACTIONS: { view: AssistantView; icon: string; title: string; subtitle: string }[] = [
  { view: "summary", icon: "\u{1F4CB}", title: "Present me Summary", subtitle: "Prioritized overview of the queue" },
  { view: "chat", icon: "\u{1F4AC}", title: "Talk to me", subtitle: "Ask anything about the queue" },
  { view: "help", icon: "❓", title: "Help me", subtitle: "Grounded in the policy note" },
  { view: "teach", icon: "\u{1F393}", title: "Teach me", subtitle: "Walk through a review, step by step" },
];

const VIEW_TITLE: Record<AssistantView, string> = {
  home: "Approvals",
  summary: "Present me Summary",
  chat: "Talk to me",
  help: "Help me",
  teach: "Teach me",
};

export function ApprovalsAssistantPanel() {
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);
  const close = useAssistantStore((s) => s.close);
  const view = useAssistantStore((s) => s.view);
  const setView = useAssistantStore((s) => s.setView);
  const loadGreeting = useAssistantStore((s) => s.loadGreeting);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={open}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-700"
      >
        Open Approvals assistant
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Approvals assistant"
      className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-sm" aria-hidden>
            {"\u{1F916}"}
          </span>
          <span className="font-semibold">Approvals</span>
        </div>
        <button type="button" onClick={close} aria-label="Close assistant" className="text-white/70 hover:text-white">
          {"✕"}
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs">
        <button
          type="button"
          data-testid="assistant-back"
          onClick={() => setView("home")}
          className="flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800"
        >
          {view !== "home" && <span aria-hidden>{"←"}</span>}
          {view === "home" ? "Approvals" : VIEW_TITLE[view]}
        </button>
        <button
          type="button"
          onClick={() => void loadGreeting()}
          className="font-semibold text-violet-600 hover:text-violet-800"
        >
          Replay Greeting
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {view === "home" && <HomeView />}
        {view === "summary" && <SummaryView />}
        {view === "chat" && <ChatView />}
        {view === "help" && <HelpView />}
        {view === "teach" && <TeachView />}
      </div>
    </div>
  );
}

function HomeView() {
  const greeting = useAssistantStore((s) => s.greeting);
  const setView = useAssistantStore((s) => s.setView);
  const runSummary = useAssistantStore((s) => s.runSummary);
  const runTeach = useAssistantStore((s) => s.runTeach);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-violet-50 p-3">
        <StreamingAnswer
          status={greeting.status === "idle" ? "loading" : greeting.status}
          narrative={greeting.text}
          error={greeting.error}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <ActionCard
            key={a.view}
            icon={a.icon}
            title={a.title}
            subtitle={a.subtitle}
            onClick={() => {
              setView(a.view);
              if (a.view === "summary") void runSummary();
              if (a.view === "teach") void runTeach();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryView() {
  const summary = useAssistantStore((s) => s.summary);
  const runSummary = useAssistantStore((s) => s.runSummary);

  return (
    <div className="space-y-3">
      <StreamingAnswer
        status={summary.status}
        narrative={summary.narrative}
        error={summary.error}
        onRetry={() => void runSummary()}
        idleLabel="Generating your summary…"
      />
      {summary.structured && (
        <ul className="space-y-2">
          {summary.structured.alerts.map((a) => (
            <li key={a.itemId} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500">{a.reason}</p>
              </div>
              <UrgencyBadge urgency={a.urgency} />
            </li>
          ))}
        </ul>
      )}
      {summary.status === "done" && (
        <div className="flex items-center justify-between pt-1">
          <ModeBadge mode={summary.mode} />
          <button type="button" onClick={() => void runSummary()} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

function ChatView() {
  const chat = useAssistantStore((s) => s.chat);
  const sendChat = useAssistantStore((s) => s.sendChat);
  const retryChat = useAssistantStore((s) => s.retryChat);

  return (
    <div className="flex h-full flex-col">
      <ChatThread
        messages={chat.messages}
        status={chat.status}
        error={chat.error}
        placeholder="Which of these needs my attention first?"
        onSend={(m) => void sendChat(m)}
        onRetry={() => void retryChat()}
      />
      <div className="pt-2">
        <ModeBadge mode={chat.mode} />
      </div>
    </div>
  );
}

function TeachView() {
  const teach = useAssistantStore((s) => s.teach);
  const runTeach = useAssistantStore((s) => s.runTeach);
  const retryTeach = useAssistantStore((s) => s.retryTeach);

  return (
    <div className="flex h-full flex-col">
      <ChatThread
        messages={teach.messages}
        status={teach.status}
        error={teach.error}
        placeholder="Ask a follow-up…"
        onSend={(m) => void runTeach(m)}
        onRetry={() => void retryTeach()}
      />
      <div className="pt-2">
        <ModeBadge mode={teach.mode} />
      </div>
    </div>
  );
}

function HelpView() {
  const help = useAssistantStore((s) => s.help);
  const askHelp = useAssistantStore((s) => s.askHelp);
  const resetHelp = useAssistantStore((s) => s.resetHelp);
  const [draft, setDraft] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) void askHelp(draft.trim());
  }

  if (help.status === "idle") {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-slate-600">
          Ask an operational question — answers are grounded in the approval-policy note, not general knowledge.
        </p>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Who has to approve a safety-critical PDF?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        You asked: {"“"}
        {help.question}
        {"”"}
      </p>
      <StreamingAnswer
        status={help.status}
        narrative={help.narrative}
        error={help.error}
        onRetry={() => void askHelp(help.question)}
      />
      {help.structured && (
        <div className="space-y-1">
          {!help.structured.grounded && (
            <p className="text-xs font-medium text-amber-600">Not covered by the policy doc.</p>
          )}
          {help.structured.citations.map((c, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              <p className="font-semibold text-slate-600">{c.heading}</p>
              <p>{c.snippet}</p>
            </div>
          ))}
        </div>
      )}
      {help.status === "done" && (
        <div className="flex items-center justify-between pt-1">
          <ModeBadge mode={help.mode} />
          <button type="button" onClick={resetHelp} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}
