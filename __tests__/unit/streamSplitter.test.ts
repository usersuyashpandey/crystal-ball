import { StructuredStreamSplitter, STRUCTURED_MARKER } from "@/lib/llm/streamSplitter";

/**
 * The splitter sits between a live model's raw stream and the UI. Real
 * models don't reproduce formatting instructions exactly, so these tests
 * use the variations actually seen in practice, not just the ideal form.
 */
describe("StructuredStreamSplitter", () => {
  function run(chunks: string[]) {
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));
    for (const c of chunks) splitter.push(c);
    const result = splitter.finalize();
    return { shown: tokens.join(""), ...result };
  }

  it("forwards narrative tokens and captures the structured tail (ideal format)", () => {
    const r = run(["Hello there.", `\n${STRUCTURED_MARKER}\n`, '{"alerts":[]}']);
    expect(r.shown).toBe("Hello there.");
    expect(r.structuredRaw).toBe('{"alerts":[]}');
  });

  it("detects the marker even when it's split across chunks", () => {
    const mid = Math.floor(STRUCTURED_MARKER.length / 2);
    const r = run(["Some narrative text\n" + STRUCTURED_MARKER.slice(0, mid), STRUCTURED_MARKER.slice(mid), '\n{"ok":true}']);
    expect(r.shown).toBe("Some narrative text");
    expect(r.structuredRaw).toBe('{"ok":true}');
  });

  it("detects the marker with no newline after it — JSON must never reach the UI", () => {
    const r = run(['Drone video first.\n<<<STRUCTURED>>>{"alerts":[]}']);
    expect(r.shown).toBe("Drone video first.");
    expect(r.shown).not.toContain("{");
    expect(r.structuredRaw).toBe('{"alerts":[]}');
  });

  it("detects the marker with no newline before it", () => {
    const r = run(['Drone video first. <<<STRUCTURED>>>\n{"alerts":[]}']);
    expect(r.shown).toBe("Drone video first.");
    expect(r.structuredRaw).toBe('{"alerts":[]}');
  });

  it("does not flush a trailing partial marker into the narrative", () => {
    const tokens: string[] = [];
    const splitter = new StructuredStreamSplitter((t) => tokens.push(t));
    splitter.push("Answer text.\n<<<STRUC");
    // Mid-stream: nothing that could be the start of the marker is shown yet.
    expect(tokens.join("")).not.toContain("<<<");
    splitter.push('TURED>>>\n{"a":1}');
    expect(splitter.finalize().structuredRaw).toBe('{"a":1}');
  });

  it("treats a response with no marker as pure narrative", () => {
    const r = run(["Just a plain reply, no structured tail."]);
    expect(r.shown).toBe("Just a plain reply, no structured tail.");
    expect(r.structuredRaw).toBeNull();
  });
});
