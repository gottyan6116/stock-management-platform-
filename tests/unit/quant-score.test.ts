import { describe, expect, it } from "vitest";
import { computeQuantScore } from "@/lib/scoring/quant-score";
import type { FinancialMetric, MetricKey } from "@/types/evidence";

let nextId = 1;
function metric(
  metricKey: MetricKey,
  value: number,
  periodEnd: string,
  periodStart = "2024-04-01"
): FinancialMetric {
  return {
    id: `m${nextId++}`,
    instrumentId: "inst-1",
    metricKey,
    value,
    unit: null,
    currency: null,
    periodType: "FY",
    periodStart,
    periodEnd,
    reportedAt: null,
    sourceId: null,
    sourceReportId: null,
    isManual: true,
    createdAt: "2026-08-20T00:00:00Z",
  };
}

describe("computeQuantScore", () => {
  it("returns null for every category and total when given no financials", () => {
    const result = computeQuantScore([]);
    expect(result.growth.score).toBeNull();
    expect(result.profitability.score).toBeNull();
    expect(result.financialHealth.score).toBeNull();
    expect(result.cashFlow.score).toBeNull();
    expect(result.valuation.score).toBeNull();
    expect(result.shareholderReturn.score).toBeNull();
    expect(result.total).toBeNull();
    expect(result.maxTotal).toBe(70);
  });

  it("scores growth as null with a single revenue data point (no prior period to compare)", () => {
    const result = computeQuantScore([metric("revenue", 1000, "2026-03-31")]);
    expect(result.growth.score).toBeNull();
    expect(result.growth.reason).toContain("revenue");
  });

  it("scores growth from two revenue periods, clamped at the 0%/15% band", () => {
    const flat = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 1000, "2026-03-31"),
    ]);
    expect(flat.growth.score).toBeCloseTo(0, 5);

    const strong = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 1200, "2026-03-31"),
    ]);
    expect(strong.growth.score).toBeCloseTo(15, 5);

    const negative = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 900, "2026-03-31"),
    ]);
    expect(negative.growth.score).toBeCloseTo(0, 5);
  });

  it("scores profitability from operating_margin and roe as the average of both bands", () => {
    const result = computeQuantScore([
      metric("operating_margin", 10, "2026-03-31"), // midpoint of 0-20 band -> 0.5 fraction
      metric("roe", 20, "2026-03-31"), // top of 0-20 band -> 1.0 fraction
    ]);
    // average fraction = 0.75 -> 0.75 * 15 = 11.25
    expect(result.profitability.score).toBeCloseTo(11.25, 5);
  });

  it("scores profitability from only operating_margin when roe is absent, without penalizing for the missing metric", () => {
    const result = computeQuantScore([metric("operating_margin", 20, "2026-03-31")]);
    expect(result.profitability.score).toBeCloseTo(15, 5);
  });

  it("inverts valuation metrics so a lower PER scores higher", () => {
    const cheap = computeQuantScore([metric("per", 10, "2026-03-31")]);
    const expensive = computeQuantScore([metric("per", 30, "2026-03-31")]);
    expect(cheap.valuation.score).toBeGreaterThan(expensive.valuation.score ?? 0);
  });

  it("computes total as the sum of non-null category scores only, never inflating with a fabricated zero", () => {
    const result = computeQuantScore([
      metric("operating_margin", 20, "2026-03-31"), // profitability -> full 15 (roe absent, no penalty)
      metric("dividend_yield", 4, "2026-03-31"), // shareholderReturn -> full 5
    ]);
    expect(result.profitability.score).toBeCloseTo(15, 5);
    expect(result.shareholderReturn.score).toBeCloseTo(5, 5);
    expect(result.growth.score).toBeNull();
    expect(result.financialHealth.score).toBeNull();
    expect(result.cashFlow.score).toBeNull();
    expect(result.valuation.score).toBeNull();
    expect(result.total).toBeCloseTo(20, 5);
    expect(result.maxTotal).toBe(70);
  });

  it("every category carries a non-empty reason string", () => {
    const result = computeQuantScore([metric("roe", 15, "2026-03-31")]);
    for (const category of [
      result.growth,
      result.profitability,
      result.financialHealth,
      result.cashFlow,
      result.valuation,
      result.shareholderReturn,
    ]) {
      expect(category.reason.length).toBeGreaterThan(0);
    }
  });
});
