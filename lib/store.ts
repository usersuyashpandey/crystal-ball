import { create } from "zustand";
import type {
  ChatMessage,
  StreamMode,
  StructuredSource,
  SummaryStructured,
  HelpStructured,
  ChatStructured,
  TeachStructured,
} from "./schemas";
import { streamAssistantEndpoint } from "./streamClient";

export type AssistantView = "home" | "summary" | "chat" | "help" | "teach";
/** idle -> loading (request sent, nothing back yet) -> streaming (tokens
 * arriving) -> done | error */
export type Status = "idle" | "loading" | "streaming" | "done" | "error";

interface StreamState<TStructured> {
  status: Status;
  narrative: string;
  structured: TStructured | null;
  mode: StreamMode | null;
  structuredSource: StructuredSource | null;
  error: string | null;
}

function initialStream<T>(): StreamState<T> {
  return { status: "idle", narrative: "", structured: null, mode: null, structuredSource: null, error: null };
}

interface ConversationState {
  messages: ChatMessage[];
  status: Status;
  mode: StreamMode | null;
  error: string | null;
}

function initialConversation(): ConversationState {
  return { messages: [], status: "idle", mode: null, error: null };
}

interface GreetingState {
  text: string;
  pendingCount: number;
  mode: StreamMode | null;
  status: Status;
  error: string | null;
}

type StreamingAction = "summary" | "help" | "chat" | "teach";

/**
 * One in-flight request per action. Starting a new one aborts the previous
 * request and bumps the run id, so tokens still arriving from a superseded
 * stream are ignored instead of being appended to the new one.
 */
const inflight: Partial<Record<StreamingAction, { controller: AbortController; id: number }>> = {};
let nextRunId = 0;

function beginRun(action: StreamingAction) {
  inflight[action]?.controller.abort();
  const run = { controller: new AbortController(), id: (nextRunId += 1) };
  inflight[action] = run;
  return { signal: run.controller.signal, isCurrent: () => inflight[action]?.id === run.id };
}

function operatorLanguage(): string {
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
}

interface AssistantStore {
  isOpen: boolean;
  isExpanded: boolean;
  view: AssistantView;
  greeting: GreetingState;
  summary: StreamState<SummaryStructured>;
  help: StreamState<HelpStructured> & { question: string };
  chat: ConversationState;
  teach: ConversationState;

  open: () => void;
  close: () => void;
  toggleExpanded: () => void;
  setView: (view: AssistantView) => void;

  loadGreeting: () => Promise<void>;
  runSummary: () => Promise<void>;
  askHelp: (question: string) => Promise<void>;
  resetHelp: () => void;
  sendChat: (message: string) => Promise<void>;
  runTeach: (message?: string) => Promise<void>;
  retryChat: () => Promise<void>;
  retryTeach: () => Promise<void>;
  /** From a queue row: open the panel on Talk to me with a question about it. */
  askAbout: (itemTitle: string) => Promise<void>;
  /** Open the panel straight on one action (e.g. "Add help" -> Help me). */
  openOn: (view: AssistantView) => void;
}

export const useAssistantStore = create<AssistantStore>((set, get) => {
  /** Shared streaming for the two single-answer actions. */
  async function streamSingle<K extends "summary" | "help", T>(key: K, url: string, body: unknown) {
    const run = beginRun(key);
    const patch = (p: Partial<StreamState<T>>) => {
      if (run.isCurrent()) set((s) => ({ [key]: { ...s[key], ...p } }) as Partial<AssistantStore>);
    };

    await streamAssistantEndpoint<T>(
      url,
      body,
      {
        onToken: (text) =>
          patch({ status: "streaming", narrative: get()[key].narrative + text } as Partial<StreamState<T>>),
        onStructured: (structured) => patch({ structured } as Partial<StreamState<T>>),
        onDone: ({ mode, structuredSource }) => patch({ status: "done", mode, structuredSource }),
        onError: (error) => patch({ status: "error", error }),
      },
      run.signal,
    );
  }

  /** Shared streaming for the two conversational actions. */
  async function streamConversation(key: "chat" | "teach", url: string, body: unknown) {
    const run = beginRun(key);
    const patch = (fn: (c: ConversationState) => Partial<ConversationState>) => {
      if (run.isCurrent()) set((s) => ({ [key]: { ...s[key], ...fn(s[key]) } }) as Partial<AssistantStore>);
    };

    await streamAssistantEndpoint<ChatStructured | TeachStructured>(
      url,
      body,
      {
        onToken: (text) =>
          patch((c) => {
            const messages = [...c.messages];
            const last = messages[messages.length - 1];
            messages[messages.length - 1] = { ...last, content: last.content + text };
            return { status: "streaming", messages };
          }),
        onStructured: () => {},
        onDone: ({ mode }) => patch(() => ({ status: "done", mode })),
        onError: (error) => patch(() => ({ status: "error", error })),
      },
      run.signal,
    );
  }

  function appendExchange(key: "chat" | "teach", userMessage: string) {
    set((s) => ({
      [key]: {
        ...s[key],
        status: "loading",
        error: null,
        messages: [...s[key].messages, { role: "user", content: userMessage }, { role: "assistant", content: "" }],
      },
    }) as Partial<AssistantStore>);
  }

  /** Remove the failed exchange (the last user message and anything after
   * it) and return that message's content, so a retry doesn't duplicate it. */
  function popLastExchange(key: "chat" | "teach"): string | undefined {
    const { messages } = get()[key];
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    set((s) => ({
      [key]: { ...s[key], error: null, messages: lastUserIdx === -1 ? [] : s[key].messages.slice(0, lastUserIdx) },
    }) as Partial<AssistantStore>);
    return lastUserIdx === -1 ? undefined : messages[lastUserIdx].content;
  }

  return {
    isOpen: false,
    isExpanded: false,
    view: "home",
    greeting: { text: "", pendingCount: 0, mode: null, status: "idle", error: null },
    summary: initialStream<SummaryStructured>(),
    help: { ...initialStream<HelpStructured>(), question: "" },
    chat: initialConversation(),
    teach: initialConversation(),

    open: () => {
      set({ isOpen: true });
      if (get().greeting.status === "idle") void get().loadGreeting();
    },
    close: () => set({ isOpen: false }),
    toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
    setView: (view) => set({ view }),

    loadGreeting: async () => {
      set((s) => ({ greeting: { ...s.greeting, status: "loading", error: null } }));
      try {
        const res = await fetch("/api/assistant/greeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Couldn't load the greeting.");
        set({
          greeting: { text: data.greeting, pendingCount: data.pendingCount, mode: data.mode, status: "done", error: null },
        });
      } catch (err) {
        set((s) => ({
          greeting: {
            ...s.greeting,
            status: "error",
            error: err instanceof Error ? err.message : "Couldn't load the greeting.",
          },
        }));
      }
    },

    runSummary: async () => {
      set({ summary: { ...initialStream<SummaryStructured>(), status: "loading" } });
      await streamSingle<"summary", SummaryStructured>("summary", "/api/assistant/summary", {
        language: operatorLanguage(),
      });
    },

    askHelp: async (question: string) => {
      set({ help: { ...initialStream<HelpStructured>(), status: "loading", question } });
      await streamSingle<"help", HelpStructured>("help", "/api/assistant/help", { question });
    },

    resetHelp: () => {
      inflight.help?.controller.abort();
      set({ help: { ...initialStream<HelpStructured>(), question: "" } });
    },

    sendChat: async (message: string) => {
      const history = get().chat.messages;
      appendExchange("chat", message);
      await streamConversation("chat", "/api/assistant/chat", { message, history });
    },

    runTeach: async (message?: string) => {
      const history = get().teach.messages;
      appendExchange("teach", message ?? "Walk me through how to review and act on an approval.");
      await streamConversation("teach", "/api/assistant/teach", { message, history });
    },

    retryChat: async () => {
      const content = popLastExchange("chat");
      if (content !== undefined) await get().sendChat(content);
    },

    askAbout: async (itemTitle: string) => {
      get().open();
      set({ view: "chat" });
      await get().sendChat(`Tell me about "${itemTitle}". What should I check before approving it?`);
    },

    openOn: (view) => {
      get().open();
      set({ view });
    },

    retryTeach: async () => {
      const content = popLastExchange("teach");
      // The very first Teach request has no typed message; the server
      // supplies the default "walk me through" prompt when it's omitted.
      const isDefaultOpener = get().teach.messages.length === 0;
      await get().runTeach(isDefaultOpener ? undefined : content);
    },
  };
});
