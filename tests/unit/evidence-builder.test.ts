import { describe, expect, it } from "vitest";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";

const company: CompanySnapshot = {
  instrumentId: "inst-1",
  providerSymbol: "6758.T",
  name: "Sony Group Corporation",
  exchange: "Tokyo",
  market: "JP",
  currency: "JPY",
  sector: null,
  industry: null,
};

const market: MarketSnapshot = {
  priceDate: "2026-08-20",
  close: 3785,
  previousClose: 3777,
  change: 8,
  changePercent: 0.21,
  dividendYield: 0.93,
  trailingPE: 20.29,
  marketCap: null,
};

function emptyEvidenceInputs() {
  return {
    company,
    market,
    financials: [],
    managementStatements: [],
    catalysts: [],
    risks: [],
    events: [],
    opinions: [],
    research: [],
  };
}

describe("buildInvestmentEvidence", () => {
  it("assembles a packet with all input arrays passed through unchanged", () => {
    const financials = [
      {
        id: "m1",
        instrumentId: "inst-1",
        metricKey: "roe" as const,
        value: 15.2,
        unit: null,
        currency: null,
        periodType: "FY" as const,
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
        reportedAt: null,
        sourceId: null,
        sourceReportId: null,
        isManual: true,
        createdAt: "2026-08-20T00:00:00Z",
      },
    ];
    const evidence = buildInvestmentEvidence({ ...emptyEvidenceInputs(), financials });
    expect(evidence.financials).toBe(financials);
    expect(evidence.company).toEqual(company);
    expect(evidence.market).toEqual(market);
  });

  it("sets generatedAt to a valid ISO timestamp", () => {
    const evidence = buildInvestmentEvidence(emptyEvidenceInputs());
    expect(() => new Date(evidence.generatedAt).toISOString()).not.toThrow();
  });

  it("reports zero coverage for every category when all inputs are empty", () => {
    const evidence = buildInvestmentEvidence(emptyEvidenceInputs());
    expect(evidence.dataCoverage).toEqual({
      financials: 0,
      management: 0,
      risks: 0,
      events: 0,
      opinions: 0,
      research: 0,
      overall: 0,
    });
  });

  it("reports full coverage for a category with at least one entry, without inflating others", () => {
    const evidence = buildInvestmentEvidence({
      ...emptyEvidenceInputs(),
      risks: [
        {
          id: "r1",
          instrumentId: "inst-1",
          riskType: "fx",
          description: "Yen risk",
          severity: "medium",
          likelihood: null,
          sourceId: null,
          sourceReportId: null,
          detectedAt: null,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
    });
    expect(evidence.dataCoverage.risks).toBe(1);
    expect(evidence.dataCoverage.financials).toBe(0);
    expect(evidence.dataCoverage.overall).toBeCloseTo(1 / 6, 5);
  });

  it("computes overall coverage as the mean of the six category scores", () => {
    const evidence = buildInvestmentEvidence({
      ...emptyEvidenceInputs(),
      financials: [
        {
          id: "m1",
          instrumentId: "inst-1",
          metricKey: "revenue" as const,
          value: 100,
          unit: null,
          currency: "JPY" as const,
          periodType: "FY" as const,
          periodStart: "2025-04-01",
          periodEnd: "2026-03-31",
          reportedAt: null,
          sourceId: null,
          sourceReportId: null,
          isManual: true,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
      events: [
        {
          id: "e1",
          instrumentId: "inst-1",
          eventType: "earnings" as const,
          title: "Q2 results",
          description: null,
          eventDate: "2026-08-05",
          sourceId: null,
          sourceReportId: null,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
    });
    expect(evidence.dataCoverage.financials).toBe(1);
    expect(evidence.dataCoverage.events).toBe(1);
    expect(evidence.dataCoverage.management).toBe(0);
    expect(evidence.dataCoverage.overall).toBeCloseTo(2 / 6, 5);
  });
});
