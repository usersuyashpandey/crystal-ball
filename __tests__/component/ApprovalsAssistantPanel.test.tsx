import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApprovalsAssistantPanel } from "@/components/ApprovalsAssistantPanel";
import { useAssistantStore } from "@/lib/store";
import { controllableSse, jsonResponse } from "../helpers/fakeSse";

/**
 * The whole panel with a real store and a fake network: the loading ->
 * streaming -> done/error states are driven by bytes arriving, the way they
 * are in the browser, not by passing a status prop.
 */

type Route = (init: RequestInit) => Response | Promise<Response>;
let routes: Record<string, Route[]>;

function onRequest(path: string, handler: Route) {
  (routes[path] ??= []).push(handler);
}

const greeting = () =>
  jsonResponse(200, { greeting: "Welcome back — 4 items pending.", pendingCount: 4, generatedAt: "t", mode: "mock" });

beforeEach(() => {
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
  routes = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const next = routes[url]?.shift();
      if (!next) throw new Error(`unexpected request to ${url}`);
      return next(init);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function openPanel() {
  onRequest("/api/assistant/greeting", greeting);
  render(<ApprovalsAssistantPanel />);
  fireEvent.click(screen.getByText("Open Approvals assistant"));
  expect(await screen.findByText("Welcome back — 4 items pending.")).toBeInTheDocument();
}

describe("ApprovalsAssistantPanel", () => {
  it("Present me Summary: shows loading, then text as it streams in, then the finished result", async () => {
    const sse = controllableSse();
    onRequest("/api/assistant/summary", () => sse.response);
    await openPanel();

    fireEvent.click(screen.getByText("Present me Summary"));
    expect(screen.getByTestId("answer-loading")).toBeInTheDocument();

    await act(async () => sse.frame("token", { text: "The drone video " }));
    expect(await screen.findByText(/The drone video/)).toBeInTheDocument();
    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-loading")).not.toBeInTheDocument();

    await act(async () => {
      sse.frame("token", { text: "needs you first." });
      sse.frame("structured", {
        alerts: [{ itemId: "drone-patrol-video-demo", title: "Level 2 Drone Patrol Video Demo", urgency: "high", reason: "past SLA" }],
        generatedAt: "t",
      });
      sse.frame("done", { mode: "live", structuredSource: "model" });
      sse.close();
    });

    await waitFor(() => expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument());
    expect(screen.getByTestId("answer-text")).toHaveTextContent("The drone video needs you first.");
    expect(screen.getByText("Level 2 Drone Patrol Video Demo")).toBeInTheDocument();
    expect(screen.getByText("Live model")).toBeInTheDocument();
  });

  it("Present me Summary: shows an error with a working Retry when the request fails", async () => {
    onRequest("/api/assistant/summary", () => jsonResponse(500, { error: "x", message: "The assistant is unavailable." }));
    const retrySse = controllableSse();
    onRequest("/api/assistant/summary", () => retrySse.response);
    await openPanel();

    fireEvent.click(screen.getByText("Present me Summary"));
    expect(await screen.findByText("The assistant is unavailable.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("retry-button"));
    await act(async () => {
      retrySse.frame("token", { text: "Recovered." });
      retrySse.frame("structured", { alerts: [], generatedAt: "t" });
      retrySse.frame("done", { mode: "mock", structuredSource: "model" });
      retrySse.close();
    });
    expect(await screen.findByText("Recovered.")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-error")).not.toBeInTheDocument();
  });

  it("Present me Summary: tells the operator when the list is the built-in fallback, not the model's", async () => {
    const sse = controllableSse();
    onRequest("/api/assistant/summary", () => sse.response);
    await openPanel();

    fireEvent.click(screen.getByText("Present me Summary"));
    await act(async () => {
      sse.frame("token", { text: "Summary." });
      sse.frame("structured", { alerts: [], generatedAt: "t" });
      sse.frame("done", { mode: "live", structuredSource: "fallback" });
      sse.close();
    });

    expect(await screen.findByTestId("fallback-note")).toBeInTheDocument();
  });

  it("Present me Summary: a connection that drops mid-stream ends in an error, not an endless cursor", async () => {
    const sse = controllableSse();
    onRequest("/api/assistant/summary", () => sse.response);
    await openPanel();

    fireEvent.click(screen.getByText("Present me Summary"));
    await act(async () => {
      sse.frame("token", { text: "Half an ans" });
      sse.close();
    });

    expect(await screen.findByTestId("answer-error")).toBeInTheDocument();
    expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
  });

  it("Talk to me: streams the reply into the thread and re-enables input when done", async () => {
    const sse = controllableSse();
    onRequest("/api/assistant/chat", () => sse.response);
    await openPanel();

    fireEvent.click(screen.getByText("Talk to me"));
    const input = screen.getByPlaceholderText("Which of these needs my attention first?");
    fireEvent.change(input, { target: { value: "which first?" } });
    fireEvent.click(screen.getByText("Send"));

    expect(screen.getByText("which first?")).toBeInTheDocument();
    expect(input).toBeDisabled();

    await act(async () => sse.frame("token", { text: "The safety " }));
    expect(await screen.findByText(/The safety/)).toBeInTheDocument();

    await act(async () => {
      sse.frame("token", { text: "specs PDF." });
      sse.frame("structured", { generatedAt: "t", referencedItemIds: [] });
      sse.frame("done", { mode: "mock", structuredSource: "model" });
      sse.close();
    });
    expect(await screen.findByText("The safety specs PDF.")).toBeInTheDocument();
    await waitFor(() => expect(input).not.toBeDisabled());
  });
});

describe("ApprovalsAssistantPanel — header controls and footer (reference panel parity)", () => {
  it("has info, expand and close controls in the header", async () => {
    await openPanel();
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("data-expanded", "false");
    fireEvent.click(screen.getByLabelText("Expand assistant"));
    expect(dialog).toHaveAttribute("data-expanded", "true");
    fireEvent.click(screen.getByLabelText("Collapse assistant"));
    expect(dialog).toHaveAttribute("data-expanded", "false");

    fireEvent.click(screen.getByLabelText("About this assistant"));
    expect(screen.getByTestId("assistant-info")).toHaveTextContent(/approval-policy/i);

    fireEvent.click(screen.getByLabelText("Close assistant"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the pending item count in the footer", async () => {
    await openPanel();
    expect(screen.getByTestId("assistant-footer")).toHaveTextContent("4 items pending");
  });
});

describe("ApprovalsAssistantPanel — read the summary aloud", () => {
  async function finishSummary() {
    const sse = controllableSse();
    onRequest("/api/assistant/summary", () => sse.response);
    await openPanel();
    fireEvent.click(screen.getByText("Present me Summary"));
    await act(async () => {
      sse.frame("token", { text: "Clear the safety PDF first." });
      sse.frame("structured", { alerts: [], generatedAt: "t" });
      sse.frame("done", { mode: "mock", structuredSource: "model" });
      sse.close();
    });
    await screen.findByText("Clear the safety PDF first.");
  }

  it("speaks the finished narrative in the operator's language when speech is supported", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn(), speaking: false });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        constructor(public text: string) {}
      },
    );

    await finishSummary();
    fireEvent.click(screen.getByText("Read aloud"));

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { text: string; lang: string };
    expect(utterance.text).toBe("Clear the safety PDF first.");
    expect(utterance.lang).toBe(navigator.language);
  });

  it("hides the button when the browser has no speech synthesis", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    await finishSummary();
    expect(screen.queryByText("Read aloud")).not.toBeInTheDocument();
  });
});
