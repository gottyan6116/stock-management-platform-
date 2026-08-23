import { describe, expect, it } from "vitest";
import { parseStructuringResponse } from "@/lib/ai/research-structuring/response";

function validPayload() {
  return {
    company: { ticker: "9432.T", name: "NTT, Inc.", exchange: "Tokyo" },
    researchDate: "2026-08-22",
    sources: [
      { sourceKey: "src_1", sourceType: "chatgpt", sourceName: "ChatGPT Deep Research", evidenceClass: "fact" },
    ],
    financials: [
      {
        sourceKey: "src_1",
        metricKey: "revenue",
        value: 100,
        periodType: "FY",
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
      },
    ],
    managementStatements: [],
    catalysts: [],
    risks: [],
    investorOpinions: [],
    events: [],
    summary: "Steady growth quarter.",
  };
}

describe("parseStructuringResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = parseStructuringResponse(JSON.stringify(validPayload()));
    expect(result.company.name).toBe("NTT, Inc.");
    expect(result.financials).toHaveLength(1);
  });

  it("accepts an already-parsed object (Cloudflare models sometimes return an object, not a string)", () => {
    const result = parseStructuringResponse(validPayload());
    expect(result.summary).toBe("Steady growth quarter.");
  });

  it("throws a descriptive error when a financials entry uses a metricKey outside the allowed list", () => {
    const invalid = { ...validPayload(), financials: [{ ...validPayload().financials[0], metricKey: "made_up_metric" }] };
    expect(() => parseStructuringResponse(JSON.stringify(invalid))).toThrow();
  });

  it("throws a descriptive error when required company fields are missing", () => {
    const invalid = { ...validPayload(), company: { ticker: "9432.T" } };
    expect(() => parseStructuringResponse(JSON.stringify(invalid))).toThrow();
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => parseStructuringResponse("I could not extract anything.")).toThrow(/JSON/);
  });
});
