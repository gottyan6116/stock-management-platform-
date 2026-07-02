import { describe, expect, it } from "vitest";
import { aggregateMonthly, aggregateWeekly } from "@/lib/aggregation/aggregate";
import { filterByRange } from "@/lib/aggregation/range";
import type { DailyPrice } from "@/types/domain";

function bar(tradingDate: string, overrides: Partial<DailyPrice> = {}): DailyPrice {
  const base: DailyPrice = {
    tradingDate,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    adjustedClose: 102,
    volume: 1000,
  };
  return { ...base, ...overrides };
}

describe("aggregateWeekly", () => {
  it("Monday祝日でも火〜金の4営業日で1本の週足を生成する", () => {
    const daily = [
      bar("2024-06-11", { open: 10, close: 11, high: 12, low: 9, volume: 100 }),
      bar("2024-06-12", { open: 11, close: 12, high: 13, low: 10, volume: 100 }),
      bar("2024-06-13", { open: 12, close: 13, high: 14, low: 11, volume: 100 }),
      bar("2024-06-14", { open: 13, close: 14, high: 15, low: 12, volume: 100 }),
    ];
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ open: 10, close: 14, high: 15, low: 9, volume: 400 });
  });

  it("Friday祝日でも月〜木の4営業日で1本の週足を生成する", () => {
    const daily = [
      bar("2024-06-10", { open: 20, close: 21, high: 22, low: 19 }),
      bar("2024-06-11", { open: 21, close: 22, high: 23, low: 20 }),
      bar("2024-06-12", { open: 22, close: 23, high: 24, low: 21 }),
      bar("2024-06-13", { open: 23, close: 24, high: 25, low: 22 }),
    ];
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ open: 20, close: 24 });
  });

  it("週内の取引日が1日のみでも1本の足を生成する", () => {
    const daily = [bar("2024-06-11", { open: 50, close: 55, high: 56, low: 49, volume: 300 })];
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ open: 50, high: 56, low: 49, close: 55, volume: 300 });
  });

  it("日付が逆順に渡されても正しく集計する", () => {
    const daily = [
      bar("2024-06-14", { close: 14 }),
      bar("2024-06-11", { open: 10 }),
      bar("2024-06-13", { close: 13 }),
      bar("2024-06-12", {}),
    ];
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]?.open).toBe(10);
    expect(weekly[0]?.close).toBe(14);
  });

  it("同一日の重複データは後勝ちで1件に正規化される（冪等性）", () => {
    const daily = [bar("2024-06-11", { close: 100 }), bar("2024-06-11", { close: 999 })];
    const weekly = aggregateWeekly(daily);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]?.close).toBe(999);
  });

  it("欠損OHLCは無視して非nullの値から集計する", () => {
    const daily = [
      bar("2024-06-11", { open: null, high: null, low: 10, close: 20 }),
      bar("2024-06-12", { open: 25, high: 30, low: null, close: null }),
    ];
    const weekly = aggregateWeekly(daily);
    expect(weekly[0]).toMatchObject({ open: 25, high: 30, low: 10, close: 20 });
  });
});

describe("aggregateMonthly", () => {
  it("月末が休日でも翌月の1営業日目とは別バケットになる", () => {
    const daily = [
      bar("2024-05-31", { close: 500 }), // 金曜(月末)
      bar("2024-06-03", { open: 501 }), // 翌月月曜
    ];
    const monthly = aggregateMonthly(daily);
    expect(monthly).toHaveLength(2);
    expect(monthly[0]).toMatchObject({ tradingDate: "2024-05-31", close: 500 });
    expect(monthly[1]).toMatchObject({ tradingDate: "2024-06-03", open: 501 });
  });

  it("年末年始をまたいでも月次バケットが分かれる", () => {
    const daily = [bar("2023-12-29", { close: 111 }), bar("2024-01-04", { open: 222 })];
    const monthly = aggregateMonthly(daily);
    expect(monthly).toHaveLength(2);
    expect(monthly[0]?.tradingDate).toBe("2023-12-29");
    expect(monthly[1]?.tradingDate).toBe("2024-01-04");
  });
});

describe("filterByRange", () => {
  const series = [bar("2015-01-05"), bar("2020-01-06"), bar("2023-06-01"), bar("2025-01-15")];
  const reference = new Date("2025-06-30T00:00:00Z");

  it("1yは直近1年分のみ残す", () => {
    expect(filterByRange(series, "1y", reference).map((r) => r.tradingDate)).toEqual([
      "2025-01-15",
    ]);
  });

  it("maxは全件を返す", () => {
    expect(filterByRange(series, "max", reference)).toHaveLength(4);
  });
});
