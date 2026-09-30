interface PricePoint {
  close: number | null;
  adjustedClose: number | null;
}

// 1年 ≒ 252営業日。銘柄詳細ページの1年騰落率（length - 253番目）と同じ基準に揃える。
const TRADING_DAYS_PER_YEAR = 252;

/** 直近の調整後終値と、約1年前の調整後終値の騰落率(%)。履歴が1年に満たなければ null（0にしない）。 */
export function computeReturn1y(prices: readonly PricePoint[]): number | null {
  if (prices.length <= TRADING_DAYS_PER_YEAR) return null;
  const latest = prices[prices.length - 1]?.adjustedClose ?? null;
  const yearAgo = prices[prices.length - 1 - TRADING_DAYS_PER_YEAR]?.adjustedClose ?? null;
  if (latest === null || yearAgo === null || yearAgo === 0) return null;
  return ((latest - yearAgo) / yearAgo) * 100;
}

/** スパークライン用に最大maxPoints点へ間引く。最後の点（最新値）は必ず含める。 */
export function toSparkline(prices: readonly PricePoint[], maxPoints: number): number[] {
  const values = prices.map((p) => p.adjustedClose ?? p.close).filter((v): v is number => v !== null);
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  const sampled: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(values[Math.round(i * step)]!);
  }
  return sampled;
}
