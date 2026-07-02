import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "@/lib/market-data/mock/provider";

describe("MockMarketDataProvider", () => {
  const provider = new MockMarketDataProvider();

  it("名前・シンボル部分一致で検索できる", async () => {
    const results = await provider.search("トヨタ");
    expect(results).toHaveLength(1);
    expect(results[0]?.providerSymbol).toBe("7203.T");
  });

  it("market指定で絞り込める", async () => {
    const jpOnly = await provider.search("a", "JP");
    expect(jpOnly.every((r) => r.market === "JP")).toBe(true);
  });

  it("getQuoteは前営業日比を計算して返す", async () => {
    const quote = await provider.getQuote("AAPL");
    expect(quote.close).toBe(195.27);
    expect(quote.previousClose).toBe(195.0);
    expect(quote.change).toBeCloseTo(0.27, 5);
  });

  it("getQuoteは未知のシンボルでもnullセーフに返す", async () => {
    const quote = await provider.getQuote("UNKNOWN");
    expect(quote.close).toBeNull();
    expect(quote.change).toBeNull();
  });

  it("getDailyPricesは期間でフィルタする", async () => {
    const rows = await provider.getDailyPrices("7203.T", "2026-06-30", "2026-06-30");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tradingDate).toBe("2026-06-30");
  });
});
