import { describe, expect, it } from "vitest";
import { buildFavoriteStock } from "@/features/favorites/build-favorite-stock";
import type { FavoriteQuoteApiItem } from "@/features/favorites/quotes";
import { evaluatePositions } from "@/features/portfolio/summary";
import type { PositionApiItem } from "@/features/portfolio/types";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";
import type { Instrument } from "@/types/domain";

// Phase 0-1 回帰: 同一銘柄の価格が保有画面とお気に入り画面で一致する。
// 旧お気に入り画面はモックの正規化系列（基準価格100）を表示しており、NTT ¥171 が ¥103.8 になっていた。

const ntt: Instrument = {
  id: "i-ntt",
  providerSymbol: "9432.T",
  displaySymbol: "9432",
  name: "NTT",
  exchange: "Tokyo",
  market: "JP",
  currency: "JPY",
  instrumentType: "stock",
};

const fund: Instrument = {
  id: "i-fund",
  providerSymbol: "MANUAL:emaxis",
  displaySymbol: "emaxis",
  name: "eMAXIS Slim 全世界株式",
  exchange: null,
  market: "JP",
  currency: "JPY",
  instrumentType: "fund",
};

function quoteItem(providerSymbol: string, price: ReturnType<typeof stockPrice>): FavoriteQuoteApiItem {
  return {
    providerSymbol,
    displayPrice: price.displayPrice,
    unitDivisor: price.unitDivisor,
    previousPrice: null,
    change: null,
    changePercent: null,
    dividendYield: null,
    priceDate: price.priceDate,
    fetchedAt: null,
    return1y: null,
    sparkline: [],
  };
}

function positionFor(instrument: Instrument, price: ReturnType<typeof stockPrice>, quantity: number): PositionApiItem {
  return {
    id: "p",
    instrumentId: instrument.id,
    quantity,
    avgCost: null,
    nisaType: null,
    isManual: instrument.instrumentType === "fund",
    providerSymbol: instrument.providerSymbol,
    displaySymbol: instrument.displaySymbol,
    name: instrument.name,
    exchange: instrument.exchange,
    market: instrument.market,
    currency: instrument.currency,
    instrumentType: instrument.instrumentType,
    assetClass: instrument.instrumentType === "fund" ? "fund" : "jp_stock",
    priceDate: price.priceDate,
    fetchedAt: null,
    displayPrice: price.displayPrice,
    unitDivisor: price.unitDivisor,
    lastClose: price.displayPrice === null ? null : price.displayPrice / price.unitDivisor,
    change: null,
    changePercent: null,
  };
}

describe("same instrument, same price on every screen", () => {
  it("shows the identical stock price in favorites and holdings", () => {
    const price = stockPrice(171, "2026-09-29");
    const favorite = buildFavoriteStock(ntt, quoteItem(ntt.providerSymbol, price), "2026-09-29T00:00:00Z");
    const holding = evaluatePositions([positionFor(ntt, price, 5)])[0]!;

    expect(favorite.quote.close).toBe(171);
    expect(favorite.quote.close).toBe(holding.displayPrice);
    expect(holding.marketValue).toBe(855);
  });

  it("shows the identical NAV per 10,000 units for a fund in favorites and holdings", () => {
    const price = fundPrice({ manualUnitPrice: 38532, manualPriceDate: "2026-07-07" }, null);
    const favorite = buildFavoriteStock(fund, quoteItem(fund.providerSymbol, price), "2026-09-29T00:00:00Z");
    const holding = evaluatePositions([positionFor(fund, price, 267218)])[0]!;

    expect(favorite.quote.close).toBe(38532);
    expect(favorite.quote.close).toBe(holding.displayPrice);
    expect(holding.marketValue).toBeCloseTo(1029644.3976, 4);
  });

  it("never invents a price: a favorite without quote data has a null close, not a placeholder like 100", () => {
    const favorite = buildFavoriteStock(ntt, undefined, "2026-09-29T00:00:00Z");
    expect(favorite.quote.close).toBeNull();
    expect(favorite.return1y).toBeNull();
    expect(favorite.sparkline).toEqual([]);
  });
});
