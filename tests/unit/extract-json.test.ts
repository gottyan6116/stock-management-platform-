import { describe, expect, it } from "vitest";
import { extractJsonFromAiResponse } from "@/lib/ai/extract-json";

describe("extractJsonFromAiResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = extractJsonFromAiResponse('{"a": 1, "b": "two"}');
    expect(result).toEqual({ a: 1, b: "two" });
  });

  it("strips a markdown code fence around the JSON before parsing", () => {
    const fenced = '```json\n{"a": 1}\n```';
    expect(extractJsonFromAiResponse(fenced)).toEqual({ a: 1 });
  });

  it("strips leading/trailing prose the model added around the JSON", () => {
    const withProse = 'Here is the result:\n\n{"a": 1}\n\nLet me know if you need more.';
    expect(extractJsonFromAiResponse(withProse)).toEqual({ a: 1 });
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => extractJsonFromAiResponse("I cannot do that.")).toThrow(/JSON/);
  });

  it("throws a descriptive error when the JSON text is malformed", () => {
    expect(() => extractJsonFromAiResponse("{not valid json,,,}")).toThrow(/could not be parsed/);
  });

  it("passes an already-parsed object through unchanged", () => {
    const obj = { a: 1, nested: { b: 2 } };
    expect(extractJsonFromAiResponse(obj)).toBe(obj);
  });

  it("throws a descriptive error when given neither a string nor an object", () => {
    expect(() => extractJsonFromAiResponse(null)).toThrow(/neither/);
    expect(() => extractJsonFromAiResponse(42)).toThrow(/neither/);
  });
});
