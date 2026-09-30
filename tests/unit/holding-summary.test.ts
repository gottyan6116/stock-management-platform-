import { describe, expect, it } from "vitest";
import { summarizeHolding } from "@/features/portfolio/holding-summary";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";

describe("summarizeHolding (銘柄詳細の自分の保有状況)", () => {
  it("returns null when the instrument is not held", () => {
    expect(summarizeHolding([], stockPrice(100, null))).toBeNull();
  });

  it("sums lots across accounts and weights the average cost by quantity", () => {
    const summary = summarizeHolding(
      [
        { quantity: 5, avgCost: 100, nisaType: "growth" },
        { quantity: 5, avgCost: 200, nisaType: null },
      ],
      stockPrice(180, "2026-09-29")
    )!;
    expect(summary.quantity).toBe(10);
    expect(summary.avgCost).toBe(150);
    expect(summary.marketValue).toBe(1800);
    expect(summary.costBasis).toBe(1500);
    expect(summary.unrealizedPnl).toBe(300);
    expect(summary.unrealizedPnlPercent).toBeCloseTo(20, 6);
  });

  it("does not guess a profit when any lot has no acquisition cost (missing is not zero)", () => {
    const summary = summarizeHolding(
      [
        { quantity: 5, avgCost: 100, nisaType: null },
        { quantity: 5, avgCost: null, nisaType: null },
      ],
      stockPrice(180, null)
    )!;
    expect(summary.avgCost).toBeNull();
    expect(summary.costBasis).toBeNull();
    expect(summary.unrealizedPnl).toBeNull();
    expect(summary.marketValue).toBe(1800);
  });

  it("values a fund as 口数 × 基準価額 ÷ 10,000 and costs it the same way", () => {
    const summary = summarizeHolding(
      [{ quantity: 267218, avgCost: 21481.75, nisaType: "growth" }],
      fundPrice({ manualUnitPrice: 38532, manualPriceDate: "2026-07-07" }, null)
    )!;
    expect(summary.marketValue).toBeCloseTo(1029644.3976, 4);
    expect(summary.costBasis).toBeCloseTo((267218 * 21481.75) / 10000, 4);
    expect(summary.unrealizedPnl).toBeCloseTo(summary.marketValue! - summary.costBasis!, 6);
  });

  it("reports no valuation when the price is unavailable", () => {
    const summary = summarizeHolding([{ quantity: 1, avgCost: 10, nisaType: null }], stockPrice(null, null))!;
    expect(summary.marketValue).toBeNull();
    expect(summary.unrealizedPnl).toBeNull();
  });
});
