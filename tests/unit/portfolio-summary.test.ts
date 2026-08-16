import { describe, expect, it } from "vitest";
import {
  evaluatePositions,
  getPortfolioProfitState,
  summarizeByCurrency,
} from "@/features/portfolio/summary";
import type { PositionApiItem } from "@/features/portfolio/types";

const base: PositionApiItem = {
  id: "p1",
  quantity: 10,
  avgCost: 100,
  nisaType: null,
  isManual: false,
  providerSymbol: "7203.T",
  displaySymbol: "7203",
  name: "トヨタ自動車",
  exchange: "TSE",
  market: "JP",
  currency: "JPY",
  instrumentType: "stock",
  priceDate: "2026-08-15",
  fetchedAt: "2026-08-16T00:00:00Z",
  lastClose: 120,
  change: 2,
  changePercent: 1.7,
};

describe("portfolio summary", () => {
  it("calculates market value, cost basis, and unrealized profit", () => {
    expect(evaluatePositions([base])[0]).toMatchObject({
      marketValue: 1200,
      costBasis: 1000,
      unrealizedPnl: 200,
      unrealizedPnlPercent: 20,
    });
  });

  it("keeps currencies separate and reports mixed signs", () => {
    const rows = evaluatePositions([
      base,
      { ...base, id: "p2", currency: "USD", market: "US", avgCost: 200, lastClose: 180 },
    ]);
    expect(summarizeByCurrency(rows)).toHaveLength(2);
    expect(getPortfolioProfitState(summarizeByCurrency(rows))).toBe("mixed");
  });

  it("returns unknown when acquisition cost is missing", () => {
    const rows = evaluatePositions([{ ...base, avgCost: null }]);
    expect(getPortfolioProfitState(summarizeByCurrency(rows))).toBe("unknown");
  });

  it("tracks partial valuation coverage within one currency", () => {
    const summaries = summarizeByCurrency(
      evaluatePositions([base, { ...base, id: "p2", lastClose: null }])
    );

    expect(summaries[0]).toMatchObject({
      positionCount: 2,
      valuedCount: 1,
      costedCount: 1,
      isValuationComplete: false,
      isCostBasisComplete: false,
    });
    expect(getPortfolioProfitState(summaries)).toBe("partial");
  });

  it("tracks complete valuation but partial profit coverage when one cost is missing", () => {
    const summaries = summarizeByCurrency(
      evaluatePositions([base, { ...base, id: "p2", avgCost: null }])
    );

    expect(summaries[0]).toMatchObject({
      positionCount: 2,
      valuedCount: 2,
      costedCount: 1,
      isValuationComplete: true,
      isCostBasisComplete: false,
    });
    expect(getPortfolioProfitState(summaries)).toBe("partial");
  });

  it("does not call a multi-currency portfolio positive when another currency is missing", () => {
    const summaries = summarizeByCurrency(
      evaluatePositions([
        base,
        {
          ...base,
          id: "p2",
          currency: "USD",
          market: "US",
          avgCost: 100,
          lastClose: null,
        },
      ])
    );

    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: "JPY", valuedCount: 1, costedCount: 1 }),
        expect.objectContaining({ currency: "USD", valuedCount: 0, costedCount: 0 }),
      ])
    );
    expect(getPortfolioProfitState(summaries)).toBe("partial");
  });
});
