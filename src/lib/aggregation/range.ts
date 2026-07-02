import type { ChartRange, DailyPrice } from "@/types/domain";

const RANGE_YEARS: Record<Exclude<ChartRange, "max">, number> = {
  "1y": 1,
  "3y": 3,
  "5y": 5,
  "10y": 10,
};

export function filterByRange(
  series: DailyPrice[],
  range: ChartRange,
  referenceDate: Date = new Date()
): DailyPrice[] {
  if (range === "max") return series;

  const years = RANGE_YEARS[range];
  const cutoff = new Date(referenceDate);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return series.filter((row) => row.tradingDate >= cutoffStr);
}
