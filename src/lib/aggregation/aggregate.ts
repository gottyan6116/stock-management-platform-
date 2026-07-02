import type { DailyPrice } from "@/types/domain";
import { isoWeekKey, monthKey } from "./period-key";

function firstNonNull(values: Array<number | null>): number | null {
  for (const v of values) {
    if (v !== null) return v;
  }
  return null;
}

function lastNonNull(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function maxNonNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
}

function minNonNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.min(...present) : null;
}

function sumVolume(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? present.reduce((acc, v) => acc + v, 0) : null;
}

/** 冪等な前処理: 昇順ソート + 同一 trading_date の重複排除（後勝ち = 最新取得を採用）。 */
function normalize(daily: DailyPrice[]): DailyPrice[] {
  const byDate = new Map<string, DailyPrice>();
  for (const row of daily) {
    byDate.set(row.tradingDate, row);
  }
  return Array.from(byDate.values()).sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
}

function aggregateByKey(daily: DailyPrice[], keyFn: (date: string) => string): DailyPrice[] {
  const sorted = normalize(daily);
  const groups = new Map<string, DailyPrice[]>();

  for (const row of sorted) {
    const key = keyFn(row.tradingDate);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const result: DailyPrice[] = [];
  for (const rows of groups.values()) {
    if (rows.length === 0) continue;
    const lastRow = rows[rows.length - 1]!;
    result.push({
      tradingDate: lastRow.tradingDate,
      open: firstNonNull(rows.map((r) => r.open)),
      high: maxNonNull(rows.map((r) => r.high)),
      low: minNonNull(rows.map((r) => r.low)),
      close: lastNonNull(rows.map((r) => r.close)),
      adjustedClose: lastNonNull(rows.map((r) => r.adjustedClose)),
      volume: sumVolume(rows.map((r) => r.volume)),
    });
  }

  return result.sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
}

/** 週足集計: ISO week単位。取引日が1日でもあれば足を生成し、その週の最終取引日を代表日とする。 */
export function aggregateWeekly(daily: DailyPrice[]): DailyPrice[] {
  return aggregateByKey(daily, isoWeekKey);
}

/** 月足集計: 暦月単位。 */
export function aggregateMonthly(daily: DailyPrice[]): DailyPrice[] {
  return aggregateByKey(daily, monthKey);
}
