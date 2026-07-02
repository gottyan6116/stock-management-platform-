import { describe, expect, it } from "vitest";
import { computeFavoriteBasketIndex } from "@/lib/aggregation/basket-index";
import type { DailyPrice } from "@/types/domain";

function point(tradingDate: string, adjustedClose: number | null): DailyPrice {
  return { tradingDate, open: null, high: null, low: null, close: adjustedClose, adjustedClose, volume: null };
}

describe("computeFavoriteBasketIndex", () => {
  it("開始時点を100として等ウェイト平均する", () => {
    const seriesA = [point("2024-01-01", 100), point("2024-01-02", 110)]; // +10%
    const seriesB = [point("2024-01-01", 50), point("2024-01-02", 45)]; // -10%

    const basket = computeFavoriteBasketIndex([seriesA, seriesB]);
    expect(basket[0]).toMatchObject({ date: "2024-01-01", value: 100, count: 2 });
    expect(basket[1]!.value).toBeCloseTo(100, 5);
  });

  it("1年前データがない銘柄はその日の平均から除外する", () => {
    const seriesA = [point("2024-01-01", 100), point("2024-01-02", 120)];
    const seriesB = [point("2024-01-02", 200)]; // 2024-01-01にはデータなし

    const basket = computeFavoriteBasketIndex([seriesA, seriesB]);
    const day1 = basket.find((b) => b.date === "2024-01-01");
    expect(day1).toMatchObject({ value: 100, count: 1 });
  });

  it("有効なadjustedCloseが無い銘柄は無視する", () => {
    const seriesA = [point("2024-01-01", 100)];
    const seriesEmpty = [point("2024-01-01", null)];
    const basket = computeFavoriteBasketIndex([seriesA, seriesEmpty]);
    expect(basket).toHaveLength(1);
    expect(basket[0]).toMatchObject({ count: 1 });
  });
});
