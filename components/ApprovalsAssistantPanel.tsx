"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAssistantStore, type AssistantView } from "@/lib/store";
import { ArrowLeft, Bot, ExternalLink, House, Info, Maximize2, Minimize2, X } from "lucide-react";
import { ActionCard } from "./ActionCard";
import { CardArt } from "./CardArt";
import { StreamingAnswer } from "./StreamingAnswer";
import { ChatThread } from "./ChatThread";
import { UrgencyBadge } from "./UrgencyBadge";
import { ModeBadge } from "./ModeBadge";
import { pickVoice, splitIntoSentences, toSpeakableText } from "@/lib/speech";

type ActionView = Exclude<AssistantView, "home">;

const ACTIONS: { view: ActionView; title: string; description: string }[] = [
  { view: "summary", title: "Present me Summary", description: "A prioritised overview of the queue" },
  { view: "chat", title: "Talk to me", description: "Ask anything about the queue" },
  { view: "help", title: "Help me", description: "Answers grounded in the approval-policy note" },
  { view: "teach", title: "Teach me", description: "Walk through a review, step by step" },
];

const VIEW_TITLE: Record<AssistantView, string> = {
  home: "Approvals",
  summary: "Present me Summary",
  chat: "Talk to me",
  help: "Help me",
  teach: "Teach me",
};

const NAVY = "bg-[#0b1437]";

/**
 * The Approvals assistant panel, laid out like the reference screenshot:
 * navy header (avatar, title, info / expand / close), a grey sub-header
 * (home, Replay Greeting), the four action cards, a footer with the item
 * count, and a round floating toggle in the corner.
 */
export function ApprovalsAssistantPanel() {
  const isOpen = useAssistantStore((s) => s.isOpen);
  const isExpanded = useAssistantStore((s) => s.isExpanded);
  const open = useAssistantStore((s) => s.open);
  const close = useAssistantStore((s) => s.close);
  const toggleExpanded = useAssistantStore((s) => s.toggleExpanded);
  const view = useAssistantStore((s) => s.view);
  const setView = useAssistantStore((s) => s.setView);
  const loadGreeting = useAssistantStore((s) => s.loadGreeting);
  const greeting = useAssistantStore((s) => s.greeting);
  const [showInfo, setShowInfo] = useState(false);

  const size = isExpanded
    ? "w-[min(680px,calc(100vw-2rem))] h-[min(860px,calc(100vh-7rem))]"
    : "w-[min(400px,calc(100vw-2rem))] h-[min(650px,calc(100vh-10rem))]";
  const iconButton = "flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white";
  const count = greeting.status === "done" ? greeting.pendingCount : null;

  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Approvals assistant"
          data-expanded={String(isExpanded)}
          className={`fixed bottom-24 right-6 z-50 flex ${size} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all`}
        >
          <div className={`flex items-center justify-between ${NAVY} px-4 py-3.5 text-white`}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white" aria-hidden>
                <Bot className="h-5 w-5 text-amber-500" />
              </span>
              <span className="text-lg font-semibold">Approvals</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                aria-label="About this assistant"
                aria-expanded={showInfo}
                className={iconButton}
              >
                <Info className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleExpanded}
                aria-label={isExpanded ? "Collapse assistant" : "Expand assistant"}
                className={iconButton}
              >
                {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
              <button type="button" onClick={close} aria-label="Close assistant" className={iconButton}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {showInfo && (
            <div data-testid="assistant-info" className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Answers are generated from the live approvals queue and the approval-policy note. The badge under each
              answer shows whether it came from the live model, the offline mock, or a fallback.
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <button
              type="button"
              data-testid="assistant-back"
              onClick={() => setView("home")}
              className="flex items-center gap-2 font-medium text-slate-800 hover:text-slate-950"
            >
              {view === "home" ? (
                <House className="h-4 w-4 text-slate-600" aria-hidden />
              ) : (
                <ArrowLeft className="h-4 w-4 text-slate-600" aria-hidden />
              )}
              {VIEW_TITLE[view]}
            </button>
            <button
              type="button"
              onClick={() => void loadGreeting()}
              className="text-[13px] font-semibold text-orange-500 hover:text-orange-600"
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

          <div
            data-testid="assistant-footer"
            className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
          >
            <span>{count === null ? "\u00a0" : `${count} folders / items`}</span>
            <span className="flex items-center gap-1" title="The HMS panel isn't part of this demo">
              HMS Panel <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        data-testid="assistant-toggle"
        onClick={isOpen ? close : open}
        aria-label={isOpen ? "Hide assistant" : "Open Approvals assistant"}
        className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full ${NAVY} text-white shadow-lg ring-4 ring-white transition hover:scale-105`}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6 text-amber-400" />}
      </button>
    </>
  );
}

function HomeView() {
  const greeting = useAssistantStore((s) => s.greeting);
  const setView = useAssistantStore((s) => s.setView);
  const runSummary = useAssistantStore((s) => s.runSummary);
  const runTeach = useAssistantStore((s) => s.runTeach);

  return (
    <div className="space-y-4">
      <div className="px-1 text-sm text-slate-600">
        <StreamingAnswer
          status={greeting.status === "idle" ? "loading" : greeting.status}
          narrative={greeting.text}
          error={greeting.error}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {ACTIONS.map((a) => (
          <ActionCard
            key={a.view}
            art={<CardArt kind={a.view} />}
            title={a.title}
            description={a.description}
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
      {summary.status === "done" && summary.structuredSource === "fallback" && (
        <FallbackNote>
          The model&apos;s ranking couldn&apos;t be verified against the queue, so this list uses the built-in rules
          (SLA and safety flags) instead.
        </FallbackNote>
      )}
      {summary.status === "done" && (
        <div className="flex items-center justify-between pt-1">
          <ModeBadge mode={summary.mode} />
          <div className="flex items-center gap-3">
            <ReadAloudButton text={summary.narrative} />
            <button type="button" onClick={() => void runSummary()} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
              Regenerate
            </button>
          </div>
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
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
      {help.status === "done" && help.structuredSource === "fallback" && (
        <FallbackNote>
          The model&apos;s citations couldn&apos;t be used, so these are the policy sections retrieval found.
        </FallbackNote>
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

/** Shown whenever the structured part of an answer is the route's local
 * fallback rather than the model's own (validated) output. */
function FallbackNote({ children }: { children: ReactNode }) {
  return (
    <p data-testid="fallback-note" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
      {children}
    </p>
  );
}

/**
 * "Present me Summary ... out loud/in text" (brief §1): the Web Speech API,
 * in the operator's browser language, using the best installed voice and
 * text rewritten for speech, one sentence per utterance (lib/speech.ts). Rendered only where the browser
 * supports speech synthesis; this view is never server-rendered, so
 * checking the global during render can't cause a hydration mismatch.
 */
function ReadAloudButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;

  // Browsers load voices asynchronously; getVoices() is often empty at first.
  useEffect(() => {
    if (!synth?.getVoices) return;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      synth.cancel();
    };
  }, [synth]);

  if (!synth || typeof SpeechSynthesisUtterance === "undefined" || !text.trim()) return null;

  function toggle() {
    if (speaking) {
      synth!.cancel();
      setSpeaking(false);
      return;
    }
    const lang = navigator.language;
    const voice = pickVoice(voices, lang);
    const sentences = splitIntoSentences(toSpeakableText(text));
    if (sentences.length === 0) return;

    synth!.cancel();
    sentences.forEach((sentence, i) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? lang;
      utterance.rate = 0.95;
      utterance.onerror = () => setSpeaking(false);
      if (i === sentences.length - 1) utterance.onend = () => setSpeaking(false);
      synth!.speak(utterance);
    });
    setSpeaking(true);
  }

  return (
    <button type="button" onClick={toggle} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
      {speaking ? "Stop reading" : "Read aloud"}
    </button>
  );
}

