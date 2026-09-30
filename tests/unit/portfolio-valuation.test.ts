import { describe, expect, it } from "vitest";
import {
  allocate,
  listStaleFundIds,
  summarizePortfolioJpy,
  toJpy,
} from "@/lib/portfolio/valuation";
import { evaluatePositions } from "@/features/portfolio/summary";
import type { PositionApiItem } from "@/features/portfolio/types";

const fx = { usdJpy: 150, asOf: "2026-09-29" };

function pos(overrides: Partial<PositionApiItem>): PositionApiItem {
  return {
    id: "p",
    instrumentId: "i",
    quantity: 1,
    avgCost: null,
    nisaType: null,
    isManual: false,
    providerSymbol: "X",
    displaySymbol: "X",
    name: "X",
    exchange: null,
    market: "JP",
    currency: "JPY",
    instrumentType: "stock",
    assetClass: "jp_stock",
    priceDate: "2026-09-29",
    fetchedAt: null,
    displayPrice: 100,
    unitDivisor: 1,
    lastClose: 100,
    change: null,
    changePercent: null,
    ...overrides,
  };
}

describe("toJpy", () => {
  it("passes yen through and converts USD with the rate", () => {
    expect(toJpy(1000, "JPY", fx)).toBe(1000);
    expect(toJpy(10, "USD", fx)).toBe(1500);
  });

  it("returns null for USD without a rate instead of guessing one", () => {
    expect(toJpy(10, "USD", null)).toBeNull();
    expect(toJpy(null, "JPY", fx)).toBeNull();
  });
});

describe("summarizePortfolioJpy (総資産・含み損益・前日比を円換算)", () => {
  const rows = evaluatePositions([
    pos({ id: "a", quantity: 10, avgCost: 100, displayPrice: 120, lastClose: 120, change: 2 }),
    pos({
      id: "b",
      market: "US",
      currency: "USD",
      assetClass: "us_stock",
      quantity: 2,
      avgCost: 40,
      displayPrice: 31.32,
      lastClose: 31.32,
      change: 0.5,
    }),
  ]);

  it("converts USD holdings at the given rate and adds them to the yen total", () => {
    const s = summarizePortfolioJpy(rows, fx);
    expect(s.totalValueJpy).toBeCloseTo(1200 + 2 * 31.32 * 150, 6);
    expect(s.costBasisJpy).toBeCloseTo(1000 + 2 * 40 * 150, 6);
    expect(s.unrealizedPnlJpy).toBeCloseTo(s.totalValueJpy! - s.costBasisJpy!, 6);
    expect(s.unrealizedPnlPercent).toBeCloseTo((s.unrealizedPnlJpy! / s.costBasisJpy!) * 100, 6);
    expect(s.excludedCount).toBe(0);
  });

  it("computes the day change from holdings that have a previous-close change", () => {
    const s = summarizePortfolioJpy(rows, fx);
    expect(s.dayChangeJpy).toBeCloseTo(10 * 2 + 2 * 0.5 * 150, 6);
    expect(s.dayChangeCoveredCount).toBe(2);
  });

  it("leaves USD out and reports it when there is no exchange rate (never assumes a rate)", () => {
    const s = summarizePortfolioJpy(rows, null);
    expect(s.totalValueJpy).toBe(1200);
    expect(s.excludedCount).toBe(1);
  });

  it("does not count a holding without a price toward the total or the profit", () => {
    const s = summarizePortfolioJpy(
      evaluatePositions([pos({ id: "a", quantity: 1, avgCost: 100, displayPrice: null, lastClose: null })]),
      fx
    );
    expect(s.totalValueJpy).toBeNull();
    expect(s.unrealizedPnlJpy).toBeNull();
  });

  it("reports the day change as unavailable when no holding has one (funds are hand-entered)", () => {
    const s = summarizePortfolioJpy(
      evaluatePositions([pos({ id: "f", assetClass: "fund", instrumentType: "fund", change: null })]),
      fx
    );
    expect(s.dayChangeJpy).toBeNull();
  });
});

describe("allocate (評価額ベースの配分)", () => {
  const rows = evaluatePositions([
    pos({ id: "f1", assetClass: "fund", instrumentType: "fund", nisaType: "growth", quantity: 100000, displayPrice: 40000, unitDivisor: 10000, lastClose: 4 }),
    pos({ id: "f2", assetClass: "fund", instrumentType: "fund", nisaType: "tsumitate", quantity: 50000, displayPrice: 40000, unitDivisor: 10000, lastClose: 4 }),
    pos({ id: "s1", nisaType: null, quantity: 100, displayPrice: 100, lastClose: 100 }),
  ]);

  it("weights by market value in yen, not by number of holdings", () => {
    const byClass = allocate(rows, fx, "assetClass");
    const fund = byClass.find((r) => r.key === "fund")!;
    expect(fund.valueJpy).toBe(400000 + 200000);
    expect(byClass.find((r) => r.key === "jp_stock")!.valueJpy).toBe(10000);
    expect(byClass.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 9);
    expect(byClass[0]!.key).toBe("fund");
  });

  it("splits by account with taxable as the default bucket", () => {
    const byAccount = allocate(rows, fx, "account");
    expect(byAccount.map((r) => r.key).sort()).toEqual(["growth", "taxable", "tsumitate"]);
    expect(byAccount.find((r) => r.key === "taxable")!.label).toBe("課税口座");
  });
});

describe("listStaleFundIds (要対応: 基準価額が未更新)", () => {
  const today = "2026-09-29";
  it("counts distinct funds whose NAV is older than a week, once per fund not per lot", () => {
    const rows = [
      pos({ id: "1", instrumentId: "fundA", assetClass: "fund", instrumentType: "fund", priceDate: "2026-07-07" }),
      pos({ id: "2", instrumentId: "fundA", assetClass: "fund", instrumentType: "fund", priceDate: "2026-07-07" }),
      pos({ id: "3", instrumentId: "fundB", assetClass: "fund", instrumentType: "fund", priceDate: "2026-09-28" }),
      pos({ id: "4", instrumentId: "stock", assetClass: "jp_stock", priceDate: "2026-01-01" }),
    ];
    expect(listStaleFundIds(evaluatePositions(rows), today)).toEqual(["fundA"]);
  });

  it("treats a fund with no NAV date as stale", () => {
    const rows = [pos({ instrumentId: "fundC", assetClass: "fund", instrumentType: "fund", priceDate: null })];
    expect(listStaleFundIds(evaluatePositions(rows), today)).toEqual(["fundC"]);
  });
});
