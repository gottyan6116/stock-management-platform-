import { describe, expect, it } from "vitest";
import { ResearchImportSchema } from "@/lib/evidence/schemas";

describe("ResearchImportSchema", () => {
  it("accepts a minimal valid research import", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [{ sourceType: "chatgpt", sourceName: "ChatGPT Deep Research" }],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "Sony's semiconductor and entertainment segments show accelerating margin expansion.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated research import with nested evidence", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [
        { sourceType: "official_ir", sourceName: "FY2026 Q2 Earnings Presentation", sourceUrl: "https://example.com/ir" },
      ],
      financials: [
        {
          metricKey: "operating_margin",
          value: 12.4,
          unit: "percent",
          periodType: "Q",
          periodStart: "2026-04-01",
          periodEnd: "2026-06-30",
        },
      ],
      managementStatements: [
        {
          personName: "Kenichiro Yoshida",
          role: "CEO",
          statement: "We expect the semiconductor segment to sustain double-digit margin growth.",
          topic: "guidance",
        },
      ],
      catalysts: [{ description: "New image sensor product launch expected Q3", impact: "high" }],
      risks: [{ riskType: "fx", description: "Yen appreciation could compress overseas segment margins", severity: "medium" }],
      investorOpinions: [{ author: "Jane Analyst", summary: "Overweight rating on margin trajectory", rating: 4 }],
      events: [{ eventType: "earnings", title: "Q2 FY2026 results announced", eventDate: "2026-08-05" }],
      summary: "Comprehensive research on Sony Group covering financials, guidance, and competitive risk.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing company ticker with a field-specific error path", () => {
    const result = ResearchImportSchema.safeParse({
      company: { name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["company", "ticker"]);
    }
  });

  it("rejects an invalid financial metric period range (end before start)", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [
        {
          metricKey: "revenue",
          value: 1000,
          periodType: "FY",
          periodStart: "2026-04-01",
          periodEnd: "2025-04-01",
        },
      ],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "financials.0.periodEnd")).toBe(true);
    }
  });

  it("rejects an unknown metricKey not in the MetricKey union", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [
        { metricKey: "made_up_metric", value: 1, periodType: "FY", periodStart: "2026-04-01", periodEnd: "2027-03-31" },
      ],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a research import with no summary", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "",
    });
    expect(result.success).toBe(false);
  });
});
