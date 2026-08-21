import { describe, expect, it } from "vitest";
import { computeEvidenceHash } from "@/lib/evidence/hash";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";
import type { FinancialMetric } from "@/types/evidence";

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

function metric(id: string): FinancialMetric {
  return {
    id,
    instrumentId: "inst-1",
    metricKey: "roe",
    value: 15,
    unit: null,
    currency: null,
    periodType: "FY",
    periodStart: "2025-04-01",
    periodEnd: "2026-03-31",
    reportedAt: null,
    sourceId: null,
    sourceReportId: null,
    isManual: true,
    createdAt: "2026-08-20T00:00:00Z",
  };
}

function baseInput(financials: FinancialMetric[] = []) {
  return {
    company,
    market,
    financials,
    managementStatements: [],
    catalysts: [],
    risks: [],
    events: [],
    opinions: [],
    research: [],
  };
}

describe("computeEvidenceHash", () => {
  it("produces the same hash for the same set of evidence IDs regardless of array order", () => {
    const a = buildInvestmentEvidence(baseInput([metric("m1"), metric("m2")]));
    const b = buildInvestmentEvidence(baseInput([metric("m2"), metric("m1")]));
    expect(computeEvidenceHash(a)).toBe(computeEvidenceHash(b));
  });

  it("produces a different hash when the evidence set changes", () => {
    const a = buildInvestmentEvidence(baseInput([metric("m1")]));
    const b = buildInvestmentEvidence(baseInput([metric("m1"), metric("m2")]));
    expect(computeEvidenceHash(a)).not.toBe(computeEvidenceHash(b));
  });

  it("returns a 64-character hex sha256 digest", () => {
    const evidence = buildInvestmentEvidence(baseInput());
    expect(computeEvidenceHash(evidence)).toMatch(/^[0-9a-f]{64}$/);
  });
});
