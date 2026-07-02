import { describe, expect, it } from "vitest";
import {
  mapYahooChartQuoteToDailyPrice,
  mapYahooQuoteToSnapshot,
  mapYahooSearchQuoteToInstrument,
} from "@/lib/market-data/yahoo/mapper";

describe("mapYahooSearchQuoteToInstrument", () => {
  it("EQUITYを正しく正規化する", () => {
    const result = mapYahooSearchQuoteToInstrument({
      symbol: "aapl",
      exchange: "NMS",
      exchDisp: "NASDAQ",
      longname: "Apple Inc.",
      quoteType: "EQUITY",
      isYahooFinance: true,
    });
    expect(result).toEqual({
      providerSymbol: "AAPL",
      displaySymbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      market: "US",
      currency: "USD",
      instrumentType: "stock",
    });
  });

  it("日本株の.Tシンボルを正しく判定する", () => {
    const result = mapYahooSearchQuoteToInstrument({
      symbol: "7203.T",
      exchDisp: "JPX",
      shortname: "Toyota Motor",
      quoteType: "EQUITY",
      isYahooFinance: true,
    });
    expect(result?.market).toBe("JP");
    expect(result?.currency).toBe("JPY");
    expect(result?.displaySymbol).toBe("7203");
  });

  it("暗号資産・FX等のMVP対象外種別は除外する", () => {
    expect(
      mapYahooSearchQuoteToInstrument({
        symbol: "BTC-USD",
        quoteType: "CRYPTOCURRENCY",
        isYahooFinance: true,
        longname: "Bitcoin USD",
      })
    ).toBeNull();
  });

  it("isYahooFinanceがfalseの結果は除外する", () => {
    expect(
      mapYahooSearchQuoteToInstrument({
        symbol: "X",
        quoteType: "EQUITY",
        isYahooFinance: false,
        longname: "Non Yahoo",
      })
    ).toBeNull();
  });

  it("銘柄名が無い結果は除外する", () => {
    expect(
      mapYahooSearchQuoteToInstrument({
        symbol: "AAPL",
        quoteType: "EQUITY",
        isYahooFinance: true,
      })
    ).toBeNull();
  });
});

describe("mapYahooQuoteToSnapshot", () => {
  it("欠損フィールドはnullに正規化する（0を代入しない）", () => {
    const snapshot = mapYahooQuoteToSnapshot({ symbol: "AAPL", currency: "USD" });
    expect(snapshot.close).toBeNull();
    expect(snapshot.dividendYield).toBeNull();
    expect(snapshot.marketCap).toBeNull();
  });

  it("regularMarketTimeを日付文字列(YYYY-MM-DD)に変換する", () => {
    const snapshot = mapYahooQuoteToSnapshot({
      symbol: "AAPL",
      currency: "USD",
      regularMarketTime: new Date("2026-06-30T20:00:00Z"),
      regularMarketPrice: 195.27,
    });
    expect(snapshot.priceDate).toBe("2026-06-30");
    expect(snapshot.close).toBe(195.27);
  });
});

describe("mapYahooChartQuoteToDailyPrice", () => {
  it("adjcloseが無い場合closeで代替する", () => {
    const row = mapYahooChartQuoteToDailyPrice("AAPL", {
      date: new Date("2026-06-30T00:00:00Z"),
      open: 194,
      high: 196,
      low: 193,
      close: 195,
      volume: 1000,
    });
    expect(row?.adjustedClose).toBe(195);
  });

  it("dateが無効な行はnullを返す", () => {
    expect(mapYahooChartQuoteToDailyPrice("AAPL", { close: 100 })).toBeNull();
  });
});
