import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StreamingAnswer } from "@/components/StreamingAnswer";

/**
 * Covers the brief's "Loading and error states are visibly handled, not
 * just happy path" requirement (§3) for the chat panel's answer area —
 * this is the component every action's single-shot view (Summary, Help)
 * renders through.
 */
describe("StreamingAnswer", () => {
  it("shows a loading skeleton before any text has arrived", () => {
    render(<StreamingAnswer status="loading" narrative="" />);
    expect(screen.getByTestId("answer-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-text")).not.toBeInTheDocument();
  });

  it("renders partial text with a streaming cursor while streaming", () => {
    render(<StreamingAnswer status="streaming" narrative="Level 2 Drone Patrol Video Demo needs" />);
    const text = screen.getByTestId("answer-text");
    expect(text).toHaveTextContent("Level 2 Drone Patrol Video Demo needs");
    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
  });

  it("renders the full text with no cursor once done", () => {
    render(<StreamingAnswer status="done" narrative="Here is the complete summary." />);
    expect(screen.getByTestId("answer-text")).toHaveTextContent("Here is the complete summary.");
    expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
  });

  it("shows the error message and calls onRetry when the retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<StreamingAnswer status="error" narrative="" error="The assistant timed out." onRetry={onRetry} />);

    expect(screen.getByTestId("answer-error")).toHaveTextContent("The assistant timed out.");
    fireEvent.click(screen.getByTestId("retry-button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a retry button when no onRetry handler is provided", () => {
    render(<StreamingAnswer status="error" narrative="" error="Something broke." />);
    expect(screen.queryByTestId("retry-button")).not.toBeInTheDocument();
  });

  it("shows nothing meaningful before any request has been made (idle)", () => {
    render(<StreamingAnswer status="idle" narrative="" idleLabel="Ask a question to get started." />);
    expect(screen.getByText("Ask a question to get started.")).toBeInTheDocument();
  });
});
