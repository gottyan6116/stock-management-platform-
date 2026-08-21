import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "@/lib/ai/investment-analysis/response";

function validPayload() {
  return {
    executiveSummary: "Sony shows steady profitability with moderate valuation risk.",
    mediumTerm: { score: 72, rating: "Attractive", thesis: "Margin expansion continues near-term." },
    longTerm: { score: 80, rating: "Strong", thesis: "Diversified segments support durable growth." },
    bullCase: { thesis: "Sensor demand accelerates.", triggers: ["New flagship smartphone cycle"] },
    baseCase: { thesis: "Steady mid-single-digit growth.", triggers: ["In-line quarterly results"] },
    bearCase: { thesis: "Yen appreciation compresses margins.", triggers: ["Sharp JPY strengthening"] },
    strengths: ["Diversified revenue base", "Strong balance sheet"],
    weaknesses: ["FX sensitivity"],
    managementAssessment: "Guidance has been consistently met over the last 4 quarters.",
    financialAssessment: "Operating margin trending upward.",
    valuationAssessment: "PER in line with historical average.",
    competitiveAssessment: "Leading position in image sensors.",
    dataGaps: ["No recent analyst opinions imported"],
    confidence: 68,
  };
}

describe("parseAnalysisResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = parseAnalysisResponse(JSON.stringify(validPayload()));
    expect(result.executiveSummary).toContain("Sony");
    expect(result.mediumTerm.score).toBe(72);
    expect(result.longTerm.rating).toBe("Strong");
  });

  it("strips a markdown code fence around the JSON before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(validPayload()) + "\n```";
    const result = parseAnalysisResponse(fenced);
    expect(result.confidence).toBe(68);
  });

  it("strips leading/trailing prose the model added around the JSON", () => {
    const withProse = "Here is my analysis:\n\n" + JSON.stringify(validPayload()) + "\n\nLet me know if you need more.";
    const result = parseAnalysisResponse(withProse);
    expect(result.bullCase.triggers).toEqual(["New flagship smartphone cycle"]);
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => parseAnalysisResponse("I cannot analyze this company.")).toThrow(/JSON/);
  });

  it("throws a descriptive error when the JSON is well-formed but fails schema validation", () => {
    const invalid = { ...validPayload(), mediumTerm: { score: "not a number", rating: "Attractive", thesis: "x" } };
    expect(() => parseAnalysisResponse(JSON.stringify(invalid))).toThrow();
  });

  it("rejects a confidence score outside 0-100", () => {
    const invalid = { ...validPayload(), confidence: 150 };
    expect(() => parseAnalysisResponse(JSON.stringify(invalid))).toThrow();
  });
});
