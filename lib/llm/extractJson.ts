/**
 * Pulls the single JSON object out of a model's structured tail. Models
 * routinely wrap JSON in ```json fences or add a stray sentence despite
 * being told not to; taking the outermost {...} span handles both without
 * regex-parsing the content itself. Anything that still isn't valid JSON
 * (e.g. truncated output) returns null so the caller falls back visibly.
 *
 * This only extracts; the shape is always checked by a Zod schema after.
 */
export function extractJsonObject(raw: string): unknown | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
