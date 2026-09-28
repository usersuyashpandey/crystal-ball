/**
 * Every prompt that needs structured output (see /prompts) asks the model
 * for a short natural-language narrative, then a marker line, then a single
 * JSON object — one plain-text completion, no provider-specific "JSON
 * mode" or tool-use required, so Anthropic, OpenAI, and the offline mock
 * provider all speak the same shape (lib/llm/providers/*).
 *
 * StructuredStreamSplitter consumes the completion as it streams in and
 * forwards only the narrative half to the caller token-by-token, holding
 * back everything from the marker onward so the UI never sees raw JSON.
 *
 * Models don't reproduce formatting instructions exactly, so the marker is
 * matched on its own — with or without the newlines we ask for around it —
 * and anything that could be the *start* of the marker (plus whitespace
 * just before it) is held back until we know whether it is.
 */

export const STRUCTURED_MARKER = "<<<STRUCTURED>>>";

/** The ideal form we ask for in prompts; the splitter accepts looser forms. */
export const STRUCTURED_DELIMITER = `\n${STRUCTURED_MARKER}\n`;

export interface SplitResult {
  narrative: string;
  /** Raw text after the marker, or null if the marker never appeared. */
  structuredRaw: string | null;
}

export class StructuredStreamSplitter {
  private buffer = "";
  private switched = false;
  private narrative = "";
  private structuredRaw = "";

  constructor(private readonly onNarrativeToken: (text: string) => void) {}

  private emit(text: string): void {
    if (!text) return;
    this.narrative += text;
    this.onNarrativeToken(text);
  }

  push(delta: string): void {
    if (this.switched) {
      this.structuredRaw += delta;
      return;
    }

    this.buffer += delta;
    const idx = this.buffer.indexOf(STRUCTURED_MARKER);

    if (idx !== -1) {
      this.emit(this.buffer.slice(0, idx).replace(/\s+$/, ""));
      this.switched = true;
      this.structuredRaw += this.buffer.slice(idx + STRUCTURED_MARKER.length);
      this.buffer = "";
      return;
    }

    // Hold back a tail long enough to contain a partial marker, and any
    // whitespace right before it, so neither leaks into the narrative.
    let safeLen = Math.max(0, this.buffer.length - (STRUCTURED_MARKER.length - 1));
    while (safeLen > 0 && /\s/.test(this.buffer[safeLen - 1])) safeLen -= 1;

    if (safeLen > 0) {
      this.emit(this.buffer.slice(0, safeLen));
      this.buffer = this.buffer.slice(safeLen);
    }
  }

  finalize(): SplitResult {
    if (!this.switched && this.buffer) {
      // No marker ever arrived — what's left is narrative, not a payload.
      this.emit(this.buffer);
      this.buffer = "";
    }
    return {
      narrative: this.narrative,
      structuredRaw: this.switched ? this.structuredRaw.trim() : null,
    };
  }
}
