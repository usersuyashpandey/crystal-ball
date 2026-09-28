/**
 * Every prompt that needs structured output (see /prompts) asks the model
 * for a short natural-language narrative, then this exact delimiter, then a
 * single JSON object — one plain-text completion, no provider-specific
 * "JSON mode" or tool-use required. That keeps Anthropic, OpenAI, and the
 * offline mock provider all speaking the same shape (lib/llm/providers/*).
 *
 * StructuredStreamSplitter consumes the completion as it streams in and
 * forwards only the narrative half to the caller token-by-token, holding
 * back everything from the delimiter onward so the UI never has to see (or
 * flash) raw JSON. It's deliberately delimiter-boundary-safe: a delimiter
 * that arrives split across two streamed chunks is still detected, because
 * we always hold back a tail at least `delimiter.length - 1` chars long
 * before flushing.
 */

export const STRUCTURED_DELIMITER = "\n<<<STRUCTURED>>>\n";

export interface SplitResult {
  narrative: string;
  /** Raw JSON text after the delimiter, or null if the delimiter never appeared. */
  structuredRaw: string | null;
}

export class StructuredStreamSplitter {
  private buffer = "";
  private switched = false;
  private narrative = "";
  private structuredRaw = "";

  constructor(
    private readonly onNarrativeToken: (text: string) => void,
    private readonly delimiter: string = STRUCTURED_DELIMITER,
  ) {}

  push(delta: string): void {
    if (this.switched) {
      this.structuredRaw += delta;
      return;
    }

    this.buffer += delta;
    const idx = this.buffer.indexOf(this.delimiter);

    if (idx !== -1) {
      const narrativePart = this.buffer.slice(0, idx);
      if (narrativePart) {
        this.narrative += narrativePart;
        this.onNarrativeToken(narrativePart);
      }
      this.switched = true;
      this.structuredRaw += this.buffer.slice(idx + this.delimiter.length);
      this.buffer = "";
      return;
    }

    // Hold back a tail long enough that a delimiter split across two chunks
    // can never be missed, and flush everything safely before it.
    const safeFlushLen = Math.max(0, this.buffer.length - (this.delimiter.length - 1));
    if (safeFlushLen > 0) {
      const toFlush = this.buffer.slice(0, safeFlushLen);
      this.narrative += toFlush;
      this.onNarrativeToken(toFlush);
      this.buffer = this.buffer.slice(safeFlushLen);
    }
  }

  finalize(): SplitResult {
    if (!this.switched && this.buffer) {
      // The delimiter never showed up — flush what's left as narrative and
      // report no structured payload, rather than losing the tail text.
      this.narrative += this.buffer;
      this.onNarrativeToken(this.buffer);
      this.buffer = "";
    }
    return {
      narrative: this.narrative,
      structuredRaw: this.switched ? this.structuredRaw.trim() : null,
    };
  }
}
