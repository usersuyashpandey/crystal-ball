import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ChatThread } from "@/components/ChatThread";

/**
 * Bug report: "chat input has white text in it". Cause: globals.css (from
 * the Next.js starter) switched the page's foreground to near-white when
 * the OS is in dark mode, and inputs inherit that colour — white text on a
 * white field. The reference UI is light-only, so the app must opt out of
 * dark mode and give inputs an explicit text colour.
 */
const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf-8");

describe("light theme (no white-on-white text)", () => {
  it("declares a light colour scheme", () => {
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  it("does not flip the foreground colour in OS dark mode", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("gives the chat input an explicit dark text colour", () => {
    render(<ChatThread messages={[]} status="idle" placeholder="Ask…" onSend={() => {}} />);
    expect(screen.getByPlaceholderText("Ask…").className).toMatch(/\btext-slate-900\b/);
  });
});
