import { describe, expect, it } from "vitest";
import { annualUsage, lifetimeBookValue, NISA_LIMITS } from "@/lib/portfolio/nisa";

describe("annualUsage", () => {
  it("sums this year's buys per account and ignores other years, sells and taxable purchases", () => {
    const usage = annualUsage(
      [
        { nisaType: "tsumitate", side: "buy", tradedOn: "2026-01-05", amountJpy: 100_000 },
        { nisaType: "tsumitate", side: "buy", tradedOn: "2026-02-05", amountJpy: 100_000 },
        { nisaType: "growth", side: "buy", tradedOn: "2026-03-01", amountJpy: 500_000 },
        { nisaType: "growth", side: "sell", tradedOn: "2026-04-01", amountJpy: 300_000 },
        { nisaType: "growth", side: "buy", tradedOn: "2025-12-31", amountJpy: 999_999 },
        { nisaType: null, side: "buy", tradedOn: "2026-05-01", amountJpy: 50_000 },
      ],
      2026
    );
    expect(usage).toEqual({ tsumitate: 200_000, growth: 500_000, total: 700_000, recordCount: 3 });
  });

  it("reports zero records so the UI can say 'not recorded' rather than '0 yen used'", () => {
    expect(annualUsage([], 2026).recordCount).toBe(0);
  });

  it("keeps the statutory limits consistent", () => {
    expect(NISA_LIMITS.annualTsumitate + NISA_LIMITS.annualGrowth).toBe(NISA_LIMITS.annualTotal);
  });
});

describe("lifetimeBookValue", () => {
  const row = (nisaType: "tsumitate" | "growth" | null, costBasis: number | null, extra = {}) => ({
    nisaType,
    nisaLegacy: false,
    costBasis,
    currency: "JPY" as const,
    ...extra,
  });

  it("uses book value of current NISA holdings, split into the growth slot", () => {
    const usage = lifetimeBookValue(
      [row("tsumitate", 1_000_000), row("growth", 2_000_000), row(null, 5_000_000)],
      null
    );
    expect(usage).toEqual({ total: 3_000_000, growth: 2_000_000, unknownCount: 0 });
  });

  it("excludes the legacy tsumitate NISA from the new-NISA quota", () => {
    const usage = lifetimeBookValue([row("tsumitate", 800_000, { nisaLegacy: true }), row("tsumitate", 100_000)], null);
    expect(usage.total).toBe(100_000);
  });

  it("counts holdings without a cost as unknown instead of treating them as zero", () => {
    expect(lifetimeBookValue([row("growth", null)], null)).toEqual({ total: 0, growth: 0, unknownCount: 1 });
  });

  it("converts a USD holding with the rate, and leaves it unknown without one", () => {
    const usd = row("growth", 100, { currency: "USD" as const });
    expect(lifetimeBookValue([usd], { usdJpy: 150, asOf: null }).growth).toBe(15_000);
    expect(lifetimeBookValue([usd], null).unknownCount).toBe(1);
  });
});
