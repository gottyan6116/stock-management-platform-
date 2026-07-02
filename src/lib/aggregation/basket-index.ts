import type { DailyPrice } from "@/types/domain";

export interface BasketIndexPoint {
  date: string;
  value: number;
  count: number;
}

/**
 * お気に入り指数（開始時点=100の等ウェイト平均）。
 * 銘柄ごとに最初の有効なadjustedCloseを100として正規化し、日付が一致する銘柄同士のみ平均する。
 */
export function computeFavoriteBasketIndex(seriesList: DailyPrice[][]): BasketIndexPoint[] {
  const normalizedSeries = seriesList
    .map((series) => {
      const valid = series.filter((row) => row.adjustedClose !== null);
      if (valid.length === 0) return [];
      const base = valid[0]!.adjustedClose!;
      if (base === 0) return [];
      return valid.map((row) => ({
        date: row.tradingDate,
        value: (row.adjustedClose! / base) * 100,
      }));
    })
    .filter((series) => series.length > 0);

  const byDate = new Map<string, number[]>();
  for (const series of normalizedSeries) {
    for (const point of series) {
      const values = byDate.get(point.date) ?? [];
      values.push(point.value);
      byDate.set(point.date, values);
    }
  }

  return Array.from(byDate.entries())
    .map(([date, values]) => ({
      date,
      value: values.reduce((acc, v) => acc + v, 0) / values.length,
      count: values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
