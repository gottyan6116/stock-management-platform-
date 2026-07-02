import { describe, expect, it } from "vitest";
import {
  dedupeSearchResults,
  detectMarketFromProviderSymbol,
  generateJapaneseTickerCandidates,
  normalizeProviderSymbol,
  normalizeSearchQuery,
  toDisplaySymbol,
} from "@/lib/market-data/normalize";
import type { InstrumentSearchResult } from "@/lib/market-data/provider";

describe("normalizeSearchQuery", () => {
  it("前後の空白を除去する", () => {
    expect(normalizeSearchQuery("  toyota  ")).toBe("toyota");
  });

  it("全角英数字を半角化する", () => {
    expect(normalizeSearchQuery("７２０３")).toBe("7203");
    expect(normalizeSearchQuery("ＡＡＰＬ")).toBe("AAPL");
  });

  it("連続する空白を1つに圧縮する", () => {
    expect(normalizeSearchQuery("apple   inc")).toBe("apple inc");
  });
});

describe("normalizeProviderSymbol", () => {
  it("大文字化し前後空白を除去する", () => {
    expect(normalizeProviderSymbol(" aapl ")).toBe("AAPL");
    expect(normalizeProviderSymbol("7203.t")).toBe("7203.T");
  });
});

describe("generateJapaneseTickerCandidates", () => {
  it("4桁の数字入力から.T候補を生成する", () => {
    expect(generateJapaneseTickerCandidates("7203")).toEqual(["7203.T"]);
    expect(generateJapaneseTickerCandidates("７２０３")).toEqual(["7203.T"]);
  });

  it("4桁以外の入力では候補を生成しない", () => {
    expect(generateJapaneseTickerCandidates("AAPL")).toEqual([]);
    expect(generateJapaneseTickerCandidates("720")).toEqual([]);
    expect(generateJapaneseTickerCandidates("72033")).toEqual([]);
  });
});

describe("detectMarketFromProviderSymbol", () => {
  it(".T接尾辞は日本株と判定する", () => {
    expect(detectMarketFromProviderSymbol("7203.T")).toBe("JP");
    expect(detectMarketFromProviderSymbol("7203.t")).toBe("JP");
  });

  it("それ以外は米国株と判定する", () => {
    expect(detectMarketFromProviderSymbol("AAPL")).toBe("US");
  });
});

describe("toDisplaySymbol", () => {
  it("日本株は.Tを除いた4桁コードを返す", () => {
    expect(toDisplaySymbol("7203.T")).toBe("7203");
  });

  it("米国株はそのまま返す（大文字化のみ）", () => {
    expect(toDisplaySymbol("aapl")).toBe("AAPL");
  });
});

describe("dedupeSearchResults", () => {
  function result(overrides: Partial<InstrumentSearchResult> = {}): InstrumentSearchResult {
    return {
      providerSymbol: "AAPL",
      displaySymbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      market: "US",
      currency: "USD",
      instrumentType: "stock",
      ...overrides,
    };
  }

  it("同一market+symbolは先勝ちで重複排除する", () => {
    const results = [result({ name: "Apple Inc." }), result({ name: "Apple (duplicate)" })];
    const deduped = dedupeSearchResults(results);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.name).toBe("Apple Inc.");
  });

  it("大文字小文字の違いは同一シンボルとして扱う", () => {
    const results = [result({ providerSymbol: "aapl" }), result({ providerSymbol: "AAPL" })];
    expect(dedupeSearchResults(results)).toHaveLength(1);
  });

  it("銘柄名が空文字の結果は除外する", () => {
    const results = [result({ name: "" }), result({ providerSymbol: "MSFT", name: "Microsoft" })];
    const deduped = dedupeSearchResults(results);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.providerSymbol).toBe("MSFT");
  });
});
