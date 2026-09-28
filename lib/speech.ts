/**
 * Helpers that make the browser's Web Speech API sound reasonable. Kept
 * free of DOM globals so they're plain unit-testable functions.
 */

/** Rewrite text the way it should be *said*, not read. */
export function toSpeakableText(text: string): string {
  return text
    .replace(/[_*`]/g, "") // markdown emphasis
    .replace(/(\d+)\s?°/g, "$1 degree")
    .replace(/\b1h\b/g, "1 hour")
    .replace(/\b(\d+)h\b/g, "$1 hours")
    .replace(/\s*[—–]\s*/g, ", ") // dashes read better as a pause
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_UTTERANCE = 200;

/**
 * One utterance per sentence: shorter utterances start faster, and Chrome
 * silently stops long ones partway. Overlong sentences are split at
 * commas (then spaces) to stay under MAX_UTTERANCE characters.
 */
export function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences.flatMap((sentence) => {
    if (sentence.length <= MAX_UTTERANCE) return [sentence];
    const pieces = sentence.split(/(?<=,)\s+/).flatMap((p) => (p.length <= MAX_UTTERANCE ? [p] : hardWrap(p)));
    return pack(pieces);
  });
}

function hardWrap(text: string): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > MAX_UTTERANCE) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

function pack(pieces: string[]): string[] {
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > MAX_UTTERANCE) {
      out.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) out.push(current);
  return out;
}

/** The subset of SpeechSynthesisVoice we use. */
export interface VoiceLike {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
}

// macOS ships many joke/robotic voices alongside the good ones, and some
// browsers default to them. Never choose these if anything else exists.
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)\b/i;
const HIGH_QUALITY = /(premium|enhanced|neural|natural|online)/i;
const KNOWN_GOOD =
  /(google|siri|samantha|daniel|karen|moira|serena|tessa|ava|zoe|allison|aria|jenny|guy|sonia|libby|lekha|rishi|veena|neel)/i;

/**
 * Picks the voice most likely to sound good for `lang`. Only voices in the
 * same language are considered; among those, quality (premium/neural
 * voices, Google's network voices, known-good system voices) outweighs an
 * exact region match, which only breaks ties. Novelty voices are never
 * chosen while anything else exists. Returns null if nothing speaks the
 * language, so the browser chooses by `lang` itself.
 */
export function pickVoice<V extends VoiceLike>(voices: V[], lang: string): V | null {
  const wanted = lang.toLowerCase().replace("_", "-");
  const base = wanted.split("-")[0];

  let best: V | null = null;
  let bestScore = -Infinity;

  for (const voice of voices) {
    const voiceLang = voice.lang.toLowerCase().replace("_", "-");
    if (voiceLang.split("-")[0] !== base) continue;

    let score = 50;
    if (voiceLang === wanted) score += 15;
    if (NOVELTY.test(voice.name)) score -= 1000;
    if (HIGH_QUALITY.test(voice.name)) score += 30;
    if (/google/i.test(voice.name)) score += 20;
    if (KNOWN_GOOD.test(voice.name)) score += 10;
    if (voice.default) score += 1;

    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }

  return best && bestScore > 0 ? best : null;
}
