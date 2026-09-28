import { create } from "zustand";
import type {
  ChatMessage,
  StreamMode,
  SummaryStructured,
  HelpStructured,
  ChatStructured,
  TeachStructured,
} from "./schemas";
import { streamAssistantEndpoint } from "./streamClient";

export type AssistantView = "home" | "summary" | "chat" | "help" | "teach";
type Status = "idle" | "loading" | "streaming" | "done" | "error";

interface StreamState<TStructured> {
  status: Status;
  narrative: string;
  structured: TStructured | null;
  mode: StreamMode | null;
  error: string | null;
}

function initialStream<T>(): StreamState<T> {
  return { status: "idle", narrative: "", structured: null, mode: null, error: null };
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

interface AssistantStore {
  isOpen: boolean;
  view: AssistantView;
  greeting: GreetingState;
  summary: StreamState<SummaryStructured>;
  help: StreamState<HelpStructured> & { question: string };
  chat: ConversationState;
  teach: ConversationState;

  open: () => void;
  close: () => void;
  setView: (view: AssistantView) => void;

  loadGreeting: () => Promise<void>;
  runSummary: () => Promise<void>;
  askHelp: (question: string) => Promise<void>;
  resetHelp: () => void;
  sendChat: (message: string) => Promise<void>;
  runTeach: (message?: string) => Promise<void>;
}

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  isOpen: false,
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
        greeting: {
          text: data.greeting,
          pendingCount: data.pendingCount,
          mode: data.mode,
          status: "done",
          error: null,
        },
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
    set({ summary: { ...initialStream<SummaryStructured>(), status: "streaming" } });
    await streamAssistantEndpoint<SummaryStructured>(
      "/api/assistant/summary",
      {},
      {
        onToken: (text) =>
          set((s) => ({ summary: { ...s.summary, narrative: s.summary.narrative + text } })),
        onStructured: (data) => set((s) => ({ summary: { ...s.summary, structured: data } })),
        onDone: (mode) => set((s) => ({ summary: { ...s.summary, status: "done", mode } })),
        onError: (error) => set((s) => ({ summary: { ...s.summary, status: "error", error } })),
      },
    );
  },

  askHelp: async (question: string) => {
    set({ help: { ...initialStream<HelpStructured>(), status: "streaming", question } });
    await streamAssistantEndpoint<HelpStructured>(
      "/api/assistant/help",
      { question },
      {
        onToken: (text) => set((s) => ({ help: { ...s.help, narrative: s.help.narrative + text } })),
        onStructured: (data) => set((s) => ({ help: { ...s.help, structured: data } })),
        onDone: (mode) => set((s) => ({ help: { ...s.help, status: "done", mode } })),
        onError: (error) => set((s) => ({ help: { ...s.help, status: "error", error } })),
      },
    );
  },

  resetHelp: () => set({ help: { ...initialStream<HelpStructured>(), question: "" } }),

  sendChat: async (message: string) => {
    const history = get().chat.messages;
    set((s) => ({
      chat: {
        ...s.chat,
        status: "streaming",
        error: null,
        messages: [...s.chat.messages, { role: "user", content: message }, { role: "assistant", content: "" }],
      },
    }));

    await streamAssistantEndpoint<ChatStructured>(
      "/api/assistant/chat",
      { message, history },
      {
        onToken: (text) =>
          set((s) => {
            const messages = [...s.chat.messages];
            const last = messages[messages.length - 1];
            messages[messages.length - 1] = { ...last, content: last.content + text };
            return { chat: { ...s.chat, messages } };
          }),
        onStructured: () => {},
        onDone: (mode) => set((s) => ({ chat: { ...s.chat, status: "done", mode } })),
        onError: (error) => set((s) => ({ chat: { ...s.chat, status: "error", error } })),
      },
    );
  },

  runTeach: async (message?: string) => {
    const history = get().teach.messages;
    const userMessage = message ?? "Walk me through how to review and act on an approval.";
    set((s) => ({
      teach: {
        ...s.teach,
        status: "streaming",
        error: null,
        messages: [
          ...s.teach.messages,
          { role: "user", content: userMessage },
          { role: "assistant", content: "" },
        ],
      },
    }));

    await streamAssistantEndpoint<TeachStructured>(
      "/api/assistant/teach",
      { message, history },
      {
        onToken: (text) =>
          set((s) => {
            const messages = [...s.teach.messages];
            const last = messages[messages.length - 1];
            messages[messages.length - 1] = { ...last, content: last.content + text };
            return { teach: { ...s.teach, messages } };
          }),
        onStructured: () => {},
        onDone: (mode) => set((s) => ({ teach: { ...s.teach, status: "done", mode } })),
        onError: (error) => set((s) => ({ teach: { ...s.teach, status: "error", error } })),
      },
    );
  },
}));
