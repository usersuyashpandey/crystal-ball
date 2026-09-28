import { extractJsonObject } from "@/lib/llm/extractJson";

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in ```json fences (the most common model deviation)", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in bare ``` fences", () => {
    expect(extractJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores stray prose around the object", () => {
    expect(extractJsonObject('Here you go:\n{"a":{"b":2}}\nHope that helps!')).toEqual({ a: { b: 2 } });
  });

  it("returns null for truncated JSON rather than throwing", () => {
    expect(extractJsonObject('{"alerts":[{"itemId":"x"')).toBeNull();
  });

  it("returns null when there is no object at all", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});
