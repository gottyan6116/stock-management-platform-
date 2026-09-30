import { describe, expect, it } from "vitest";
import { computeScenario, excessOverHurdle } from "@/lib/candidates/expected-return";
import { addYears, evaluateOutcome, latestOnOrBefore, winRate, type OutcomeStatus } from "@/lib/candidates/outcome";

describe("computeScenario", () => {
  it("decomposes into dividend + EPS growth + valuation change with the documented formula", () => {
    // PER 20 → 5年後 25、EPS成長 8%/年、配当 2%
    const r = computeScenario({ dividendYieldPct: 2, currentPer: 20, input: { epsGrowthPct: 8, exitPer: 25 } });
    const valuation = Math.pow(25 / 20, 1 / 5) - 1;
    const price = 1.08 * (1 + valuation) - 1;
    expect(r.missing).toBeNull();
    expect(r.valuationPct).toBeCloseTo(valuation * 100, 6);
    expect(r.priceCagrPct).toBeCloseTo(price * 100, 6);
    expect(r.totalAnnualPct).toBeCloseTo((0.02 + price) * 100, 6);
    expect(r.fiveYearTotalPct).toBeCloseTo((Math.pow(1 + 0.02 + price, 5) - 1) * 100, 6);
  });

  it("is a pure multiple: unchanged PER contributes 0% valuation change", () => {
    const r = computeScenario({ dividendYieldPct: 0, currentPer: 15, input: { epsGrowthPct: 10, exitPer: 15 } });
    expect(r.valuationPct).toBeCloseTo(0, 10);
    expect(r.totalAnnualPct).toBeCloseTo(10, 6);
  });

  it("does not compute (and says why) when a required assumption is missing", () => {
    const base = { dividendYieldPct: 2, currentPer: 20 };
    expect(computeScenario({ ...base, input: { epsGrowthPct: null, exitPer: 20 } }).missing).toContain("EPS成長率");
    expect(computeScenario({ ...base, input: { epsGrowthPct: 5, exitPer: null } }).missing).toContain("5年後PER");
    expect(computeScenario({ ...base, currentPer: null, input: { epsGrowthPct: 5, exitPer: 20 } }).missing).toContain("現在PER");
    expect(computeScenario({ ...base, dividendYieldPct: null, input: { epsGrowthPct: 5, exitPer: 20 } }).missing).toContain("配当利回り");
    expect(computeScenario({ ...base, input: { epsGrowthPct: 5, exitPer: 20 } }).missing).toBeNull();
  });

  it("rejects an EPS growth that would make the price factor non-positive", () => {
    const r = computeScenario({ dividendYieldPct: 1, currentPer: 10, input: { epsGrowthPct: -100, exitPer: 10 } });
    expect(r.totalAnnualPct).toBeNull();
    expect(r.missing).toContain("−100%");
  });

  it("shows the gap to the hurdle in points, and nothing when the hurdle is not set", () => {
    expect(excessOverHurdle(9.5, 5)).toBeCloseTo(4.5);
    expect(excessOverHurdle(2, 5)).toBeCloseTo(-3);
    expect(excessOverHurdle(9.5, null)).toBeNull();
    expect(excessOverHurdle(null, 5)).toBeNull();
  });
});

describe("addYears / latestOnOrBefore", () => {
  it("adds calendar years and clamps Feb 29", () => {
    expect(addYears("2026-09-30", 1)).toBe("2027-09-30");
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2026-09-30", 3)).toBe("2029-09-30");
  });

  it("picks the latest point on or before the date, only if it is recent enough", () => {
    const pts = [
      { date: "2027-08-01", value: 10 },
      { date: "2027-09-10", value: 11 },
    ];
    expect(latestOnOrBefore(pts, "2027-09-30", 45)).toEqual({ date: "2027-09-10", value: 11 });
    expect(latestOnOrBefore(pts, "2027-12-31", 45)).toBeNull();
    expect(latestOnOrBefore(pts, "2027-07-01", 45)).toBeNull();
  });
});

describe("evaluateOutcome", () => {
  const buy = { decision: "buy" as const, decidedOn: "2026-09-30", benchmarkNav: 40_000 };
  const series = [
    { date: "2026-09-30", value: 100 },
    { date: "2027-09-29", value: 130 },
  ];
  const bench = [{ date: "2027-09-15", value: 44_000 }];

  it("is pending until the horizon date, with the due date", () => {
    expect(evaluateOutcome({ record: buy, horizon: 1, today: "2027-09-29", stockSeries: series, benchmarkHistory: bench })).toEqual({
      status: "pending",
      dueDate: "2027-09-30",
    });
  });

  it("lines up stock vs benchmark returns; a buy is correct when the stock beat the benchmark", () => {
    const o = evaluateOutcome({ record: buy, horizon: 1, today: "2027-10-01", stockSeries: series, benchmarkHistory: bench });
    expect(o).toMatchObject({ status: "ready", correct: true });
    if (o.status !== "ready") throw new Error("expected ready");
    expect(o.stockReturnPct).toBeCloseTo(30, 8);
    expect(o.benchmarkReturnPct).toBeCloseTo(10, 8);
  });

  it("a pass is correct when the stock did NOT beat the benchmark", () => {
    const pass = { ...buy, decision: "pass" as const };
    const o = evaluateOutcome({ record: pass, horizon: 1, today: "2027-10-01", stockSeries: series, benchmarkHistory: bench });
    expect(o).toMatchObject({ status: "ready", correct: false });
    const weak = [
      { date: "2026-09-30", value: 100 },
      { date: "2027-09-29", value: 105 },
    ];
    expect(evaluateOutcome({ record: pass, horizon: 1, today: "2027-10-01", stockSeries: weak, benchmarkHistory: bench })).toMatchObject({ correct: true });
  });

  it("says why when benchmark data is missing instead of guessing", () => {
    expect(
      evaluateOutcome({ record: { ...buy, benchmarkNav: null }, horizon: 1, today: "2027-10-01", stockSeries: series, benchmarkHistory: bench })
    ).toMatchObject({ status: "unavailable" });
    expect(evaluateOutcome({ record: buy, horizon: 1, today: "2027-10-01", stockSeries: series, benchmarkHistory: [] })).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("オルカン"),
    });
    expect(evaluateOutcome({ record: buy, horizon: 1, today: "2027-10-01", stockSeries: [], benchmarkHistory: bench })).toMatchObject({
      status: "unavailable",
    });
  });
});

describe("winRate", () => {
  const ready = (correct: boolean): OutcomeStatus => ({ status: "ready", stockReturnPct: 1, benchmarkReturnPct: 1, correct });

  it("counts only evaluated outcomes", () => {
    const rate = winRate([ready(true), ready(false), ready(true), { status: "pending", dueDate: "2030-01-01" }, { status: "unavailable", reason: "x" }]);
    expect(rate).toEqual({ evaluated: 3, correct: 2, ratePct: (2 / 3) * 100 });
  });

  it("has no rate (not 0%) when nothing can be evaluated yet", () => {
    expect(winRate([{ status: "pending", dueDate: "2030-01-01" }])).toEqual({ evaluated: 0, correct: 0, ratePct: null });
  });
});
