import { StructuredStreamSplitter, STRUCTURED_DELIMITER } from "@/lib/llm/streamSplitter";

/**
 * This is the piece that had a real bug during development (see the
 * "prompts/context.ts" extraction regex fix) — not in the splitter itself,
 * but in a sibling piece of the same "narrative + structured JSON" scheme.
 * Locking down the splitter's own boundary handling with direct tests is
 * cheap insurance against that class of bug recurring here too.
 */
describe("StructuredStreamSplitter", () => {
  it("forwards narrative tokens and captures the structured tail", () => {
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));

    splitter.push("Hello there.");
    splitter.push(STRUCTURED_DELIMITER);
    splitter.push('{"alerts":[]}');

    const result = splitter.finalize();
    expect(tokens.join("")).toBe("Hello there.");
    expect(result.narrative).toBe("Hello there.");
    expect(result.structuredRaw).toBe('{"alerts":[]}');
  });

  it("detects the delimiter even when it's split across multiple chunks", () => {
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));

    // Split the delimiter itself into three pieces mid-token, the way real
    // network chunking might.
    const mid = Math.floor(STRUCTURED_DELIMITER.length / 2);
    splitter.push("Some narrative text" + STRUCTURED_DELIMITER.slice(0, mid));
    splitter.push(STRUCTURED_DELIMITER.slice(mid));
    splitter.push('{"ok":true}');

    const result = splitter.finalize();
    expect(tokens.join("")).toBe("Some narrative text");
    expect(result.structuredRaw).toBe('{"ok":true}');
  });

  it("never lets a false substring match (no surrounding newline) split narrative from JSON early", () => {
    // Regression test for the actual bug found in prompts/context.ts: text
    // that merely *mentions* the delimiter-like marker shouldn't be treated
    // as the real boundary. The splitter itself only ever looks for the
    // exact STRUCTURED_DELIMITER string, so this mostly documents intent.
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));

    splitter.push("This mentions <<<STRUCTURED>>> inline but not as our delimiter.");
    const result = splitter.finalize();

    // Without the delimiter's surrounding newlines, nothing switches modes.
    expect(result.structuredRaw).toBeNull();
    expect(tokens.join("")).toContain("<<<STRUCTURED>>>");
  });

  it("treats a response with no delimiter as pure narrative", () => {
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));

    splitter.push("Just a plain reply, no structured tail.");
    const result = splitter.finalize();

    expect(result.narrative).toBe("Just a plain reply, no structured tail.");
    expect(result.structuredRaw).toBeNull();
  });
});
