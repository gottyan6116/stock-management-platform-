import { describe, expect, it } from "vitest";
import { evaluatePositions } from "@/features/portfolio/summary";
import type { PositionApiItem } from "@/features/portfolio/types";
import { buildSnapshot } from "@/lib/portfolio/snapshot";

const base: PositionApiItem = {
  id: "p",
  instrumentId: "i",
  quantity: 10,
  avgCost: 100,
  nisaType: "growth",
  nisaLegacy: false,
  isManual: false,
  providerSymbol: "7203.T",
  displaySymbol: "7203",
  name: "トヨタ",
  exchange: "TSE",
  market: "JP",
  currency: "JPY",
  instrumentType: "stock",
  assetClass: "jp_stock",
  priceDate: "2026-09-30",
  fetchedAt: null,
  displayPrice: 120,
  unitDivisor: 1,
  lastClose: 120,
  change: null,
  changePercent: null,
};

const usd: PositionApiItem = {
  ...base,
  id: "u",
  providerSymbol: "HPQ",
  market: "US",
  currency: "USD",
  assetClass: "us_stock",
  nisaType: null,
  quantity: 2,
  avgCost: 40,
  displayPrice: 30,
};

describe("buildSnapshot", () => {
  it("records total, cost, rate and the account / asset class breakdown in yen", () => {
    const outcome = buildSnapshot(evaluatePositions([base, usd]), { usdJpy: 150, asOf: null });
    expect(outcome).toEqual({
      ok: true,
      record: {
        totalValueJpy: 1200 + 9000,
        totalCostJpy: 1000 + 12000,
        usdJpy: 150,
        breakdown: {
          account: { taxable: 9000, growth: 1200 },
          assetClass: { us_stock: 9000, jp_stock: 1200 },
        },
      },
    });
  });

  it("does not record when USD cannot be converted, instead of storing a falsely low total", () => {
    expect(buildSnapshot(evaluatePositions([base, usd]), null)).toEqual({ ok: false, reason: "incomplete" });
  });

  it("does not record when a holding has no price", () => {
    const unpriced = { ...base, id: "x", displayPrice: null, lastClose: null };
    expect(buildSnapshot(evaluatePositions([base, unpriced]), null)).toEqual({ ok: false, reason: "incomplete" });
  });

  it("does not record an empty portfolio", () => {
    expect(buildSnapshot([], null)).toEqual({ ok: false, reason: "no-holdings" });
  });
});
