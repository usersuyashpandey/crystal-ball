import { toSpeakableText, splitIntoSentences, pickVoice, type VoiceLike } from "@/lib/speech";

describe("toSpeakableText", () => {
  it("expands hour abbreviations so '48h' isn't read as 'forty-eight aitch'", () => {
    expect(toSpeakableText("past its 48h review SLA")).toBe("past its 48 hours review SLA");
    expect(toSpeakableText("due in 1h")).toBe("due in 1 hour");
  });

  it("turns dashes into pauses and drops quote marks the voice would stumble on", () => {
    expect(toSpeakableText('"Level 2 Drone Patrol Video Demo" needs attention first — it\'s overdue.')).toBe(
      "Level 2 Drone Patrol Video Demo needs attention first, it's overdue.",
    );
  });

  it("reads the degree sign and strips markdown emphasis", () => {
    expect(toSpeakableText("The _360°_ Spatial Zone map")).toBe("The 360 degree Spatial Zone map");
  });

  it("collapses whitespace and newlines", () => {
    expect(toSpeakableText("One.\n\n  Two.")).toBe("One. Two.");
  });
});

describe("splitIntoSentences", () => {
  it("splits on sentence ends so each utterance stays short (Chrome cuts long ones off)", () => {
    expect(splitIntoSentences("First one. Second one! Third?")).toEqual(["First one.", "Second one!", "Third?"]);
  });

  it("breaks an overly long sentence at commas", () => {
    const long = `${"word ".repeat(30).trim()}, ${"more ".repeat(30).trim()}.`;
    const parts = splitIntoSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(220);
  });

  it("drops empty fragments", () => {
    expect(splitIntoSentences("   ")).toEqual([]);
  });
});

describe("pickVoice", () => {
  const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({
    name,
    lang,
    default: false,
    localService: true,
    ...extra,
  });

  it("prefers a high-quality voice over the robotic defaults", () => {
    const voices = [v("Fred", "en-US", { default: true }), v("Albert", "en-US"), v("Samantha (Enhanced)", "en-US")];
    expect(pickVoice(voices, "en-US")?.name).toBe("Samantha (Enhanced)");
  });

  it("prefers Google / natural-sounding voices when present", () => {
    const voices = [v("Alex", "en-US"), v("Google US English", "en-US", { localService: false })];
    expect(pickVoice(voices, "en-US")?.name).toBe("Google US English");
  });

  it("matches the operator's language before quality", () => {
    const voices = [v("Samantha (Enhanced)", "en-US"), v("Lekha", "hi-IN")];
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Lekha");
  });

  it("falls back to the same base language when the exact region isn't installed", () => {
    const voices = [v("Thomas", "fr-FR"), v("Daniel", "en-GB")];
    expect(pickVoice(voices, "en-IN")?.name).toBe("Daniel");
  });

  it("never picks a novelty voice when a normal one exists", () => {
    const voices = [v("Zarvox", "en-US"), v("Bad News", "en-US"), v("Karen", "en-AU")];
    expect(pickVoice(voices, "en-US")?.name).toBe("Karen");
  });

  it("returns null when no voices are loaded yet", () => {
    expect(pickVoice([], "en-US")).toBeNull();
  });
});
