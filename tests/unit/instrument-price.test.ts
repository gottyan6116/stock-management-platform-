import { describe, expect, it } from "vitest";
import { fundPrice, marketValueOf, stockPrice } from "@/lib/pricing/instrument-price";

describe("fundPrice (0-3: 投資信託は1万口あたりの基準価額で扱う)", () => {
  it("keeps the NAV per 10,000 units as the display price and values holdings as 口数×基準価額÷10,000", () => {
    const price = fundPrice({ manualUnitPrice: 38532, manualPriceDate: "2026-07-07" }, null);
    expect(price.displayPrice).toBe(38532);
    expect(price.unitDivisor).toBe(10000);
    // 267,218口 × ¥38,532 ÷ 10,000
    expect(marketValueOf(267218, price)).toBeCloseTo(1029644.3976, 4);
  });

  it("uses the newer of the position's own price and the fund's price history, so every screen shows one NAV per fund", () => {
    const position = { manualUnitPrice: 60489, manualPriceDate: "2026-07-07" };
    const newerHistory = { unitPrice: 61000, priceDate: "2026-09-29" };
    const olderHistory = { unitPrice: 59000, priceDate: "2026-06-30" };
    expect(fundPrice(position, newerHistory)).toMatchObject({ displayPrice: 61000, priceDate: "2026-09-29" });
    expect(fundPrice(position, olderHistory)).toMatchObject({ displayPrice: 60489, priceDate: "2026-07-07" });
  });

  it("falls back to the history when the position has no manual price, and reports missing (not zero) when neither exists", () => {
    expect(fundPrice({ manualUnitPrice: null, manualPriceDate: null }, { unitPrice: 100, priceDate: "2026-09-01" }).displayPrice).toBe(100);
    const none = fundPrice({ manualUnitPrice: null, manualPriceDate: null }, null);
    expect(none.displayPrice).toBeNull();
    expect(marketValueOf(10, none)).toBeNull();
  });
});

describe("stockPrice", () => {
  it("uses the market close as-is with a divisor of 1", () => {
    const price = stockPrice(171, "2026-09-29");
    expect(price).toMatchObject({ displayPrice: 171, unitDivisor: 1 });
    expect(marketValueOf(5, price)).toBe(855);
  });

  it("reports a missing close as null", () => {
    expect(stockPrice(null, null).displayPrice).toBeNull();
  });
});
