import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApprovalsWorkspace } from "@/components/approvals/ApprovalsWorkspace";
import { useAssistantStore } from "@/lib/store";
import { APPROVALS_QUEUE } from "@/lib/queue";
import { controllableSse, jsonResponse } from "../helpers/fakeSse";

/** The page around the assistant, rebuilt to match the reference screenshot. */
beforeEach(() => {
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
});
afterEach(() => vi.unstubAllGlobals());

const rows = () => screen.getAllByTestId("approval-row");

describe("ApprovalsWorkspace", () => {
  it("lists every pending request with type, submitter, date and status, and counts them", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    expect(rows()).toHaveLength(4);
    expect(screen.getByTestId("request-count")).toHaveTextContent("4 items");
    const first = within(rows()[0]);
    expect(first.getByText("Site Patrol Onboarding & Checklists")).toBeInTheDocument();
    expect(first.getByText("My Site Patrol › My Site Patrol Card")).toBeInTheDocument();
    expect(first.getByText("Folder")).toBeInTheDocument();
    expect(first.getByText("Sam HelpAdmin")).toBeInTheDocument();
    expect(first.getByText("Pending Review")).toBeInTheDocument();
  });

  it("filters by title, author or folder as you type", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    const search = screen.getByPlaceholderText("Search approvals by title, author, folder, or page...");
    fireEvent.change(search, { target: { value: "drone" } });
    expect(rows()).toHaveLength(1);
    fireEvent.change(search, { target: { value: "elena" } });
    expect(within(rows()[0]).getByText(/360° Spatial Zone/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "site recordings" } });
    expect(rows()).toHaveLength(2);
    expect(screen.getByTestId("request-count")).toHaveTextContent("2 items");
  });

  it("says so when nothing matches", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    fireEvent.change(screen.getByPlaceholderText(/Search approvals/), { target: { value: "zzz" } });
    expect(screen.getByText(/No approvals match/)).toBeInTheDocument();
  });

  it("Hierarchy View groups requests under their top-level folder", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    fireEvent.click(screen.getByRole("button", { name: /Hierarchy View/ }));
    const groups = screen.getAllByTestId("folder-group");
    expect(groups.map((g) => g.getAttribute("data-folder"))).toEqual(["My Site Patrol", "Drawing-Videos", "Site Recordings"]);
    expect(within(groups[2]).getAllByTestId("approval-row")).toHaveLength(2);
  });

  it("selecting a row shows it in the detail pane", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    const detail = screen.getByTestId("approval-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Site Patrol Onboarding & Checklists");

    fireEvent.click(within(rows()[2]).getByText("Safety Equipment & Sensor Specs"));
    expect(within(detail).getByRole("heading")).toHaveTextContent("Safety Equipment & Sensor Specs");
    expect(rows()[2]).toHaveAttribute("aria-selected", "true");
    expect(within(detail).getByText(/overdue/i)).toBeInTheDocument();
  });

  it("the detail pane switches between Snapshot & Control and Media / Content", () => {
    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    const detail = screen.getByTestId("approval-detail");
    expect(within(detail).getByText("Screen Snapshot Target")).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("tab", { name: /Media \/ Content/ }));
    expect(within(detail).getByText("12 checklists")).toBeInTheDocument();
  });

  it("a row's actions menu can ask the assistant about that item", async () => {
    const sse = controllableSse();
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/greeting")
        ? jsonResponse(200, { greeting: "Hi", pendingCount: 4, generatedAt: "t", mode: "mock" })
        : sse.response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ApprovalsWorkspace queue={APPROVALS_QUEUE} />);
    fireEvent.click(within(rows()[1]).getByLabelText("Actions for Level 2 Drone Patrol Video Demo"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Ask the assistant/ }));

    const state = useAssistantStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.view).toBe("chat");
    const chatCall = fetchMock.mock.calls.find(([u]) => (u as string).endsWith("/chat"));
    expect(JSON.parse((chatCall![1] as RequestInit).body as string).message).toContain("Level 2 Drone Patrol Video Demo");
    await act(async () => sse.close());
  });
});
