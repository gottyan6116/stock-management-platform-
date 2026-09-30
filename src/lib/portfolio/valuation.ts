import type { Currency } from "@/types/domain";
import { ASSET_CLASS_LABEL, ASSET_CLASS_ORDER, type AssetClass } from "@/lib/domain/asset-class";
import type { EvaluatedPosition, NisaType } from "@/features/portfolio/types";

/** ドル円レート。取得できなければ null を渡し、USD分は換算せず除外する（レートを仮定しない）。 */
export interface FxRate {
  usdJpy: number;
  asOf: string | null;
}

export function toJpy(amount: number | null, currency: Currency, fx: FxRate | null): number | null {
  if (amount === null) return null;
  if (currency === "JPY") return amount;
  return fx ? amount * fx.usdJpy : null;
}

export interface PortfolioJpySummary {
  totalValueJpy: number | null;
  costBasisJpy: number | null;
  unrealizedPnlJpy: number | null;
  unrealizedPnlPercent: number | null;
  /** 前日比（円）。前営業日比を持つ保有分だけで計算する（投資信託は基準価額の手入力のため含まれない）。 */
  dayChangeJpy: number | null;
  dayChangePercent: number | null;
  dayChangeCoveredCount: number;
  /** 価格が無い、または為替レートが無くてUSDを換算できず、合計から除いた保有件数。 */
  excludedCount: number;
  /** USD建て保有の評価額（ドル）。換算に使ったレートの注記用。 */
  usdValue: number;
}

export function summarizePortfolioJpy(rows: readonly EvaluatedPosition[], fx: FxRate | null): PortfolioJpySummary {
  let total = 0;
  let valued = 0;
  let cost = 0;
  let pnl = 0;
  let costed = 0;
  let dayChange = 0;
  let dayCovered = 0;
  let dayPrevValue = 0;
  let excluded = 0;
  let usdValue = 0;

  for (const row of rows) {
    if (row.currency === "USD" && row.marketValue !== null) usdValue += row.marketValue;

    const valueJpy = toJpy(row.marketValue, row.currency, fx);
    if (valueJpy === null) {
      excluded += 1;
      continue;
    }
    total += valueJpy;
    valued += 1;

    const costJpy = toJpy(row.costBasis, row.currency, fx);
    if (costJpy !== null) {
      cost += costJpy;
      pnl += valueJpy - costJpy;
      costed += 1;
    }

    if (row.change !== null) {
      const changeJpy = toJpy((row.quantity * row.change) / row.unitDivisor, row.currency, fx);
      if (changeJpy !== null) {
        dayChange += changeJpy;
        dayPrevValue += valueJpy - changeJpy;
        dayCovered += 1;
      }
    }
  }

  return {
    totalValueJpy: valued > 0 ? total : null,
    costBasisJpy: costed > 0 ? cost : null,
    unrealizedPnlJpy: costed > 0 ? pnl : null,
    unrealizedPnlPercent: costed > 0 && cost !== 0 ? (pnl / cost) * 100 : null,
    dayChangeJpy: dayCovered > 0 ? dayChange : null,
    dayChangePercent: dayCovered > 0 && dayPrevValue !== 0 ? (dayChange / dayPrevValue) * 100 : null,
    dayChangeCoveredCount: dayCovered,
    excludedCount: excluded,
    usdValue,
  };
}

export type AllocationDimension = "account" | "assetClass";
export type AccountKey = "growth" | "tsumitate" | "taxable";

export const ACCOUNT_LABEL: Record<AccountKey, string> = {
  growth: "成長投資枠",
  tsumitate: "つみたて投資枠",
  taxable: "課税口座",
};
export const ACCOUNT_ORDER: readonly AccountKey[] = ["growth", "tsumitate", "taxable"];

export function accountKeyOf(nisaType: NisaType): AccountKey {
  return nisaType ?? "taxable";
}

export interface AllocationSlice {
  key: string;
  label: string;
  valueJpy: number;
  /** 0〜1。円換算できた評価額の合計に対する割合。 */
  share: number;
}

/** 評価額（円換算）ベースの配分。件数ベースではない。大きい順。 */
export function allocate(
  rows: readonly EvaluatedPosition[],
  fx: FxRate | null,
  dimension: AllocationDimension
): AllocationSlice[] {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const valueJpy = toJpy(row.marketValue, row.currency, fx);
    if (valueJpy === null) continue;
    const key = dimension === "account" ? accountKeyOf(row.nisaType) : row.assetClass;
    sums.set(key, (sums.get(key) ?? 0) + valueJpy);
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const labelOf = (key: string): string =>
    dimension === "account" ? ACCOUNT_LABEL[key as AccountKey] : ASSET_CLASS_LABEL[key as AssetClass];
  const order: readonly string[] = dimension === "account" ? ACCOUNT_ORDER : ASSET_CLASS_ORDER;
  return [...sums.entries()]
    .map(([key, valueJpy]) => ({ key, label: labelOf(key), valueJpy, share: total > 0 ? valueJpy / total : 0 }))
    .sort((a, b) => b.valueJpy - a.valueJpy || order.indexOf(a.key) - order.indexOf(b.key));
}

// 基準価額は手入力のため、1週間以上更新されていなければ「未更新」として要対応に出す。
const STALE_NAV_DAYS = 7;

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / (24 * 60 * 60 * 1000);
}

/** 基準価額が未更新の投資信託の instrumentId（ロットが複数あっても1ファンド1回）。 */
export function listStaleFundIds(rows: readonly EvaluatedPosition[], todayIso: string): string[] {
  const stale = new Set<string>();
  for (const row of rows) {
    if (row.assetClass !== "fund") continue;
    if (row.priceDate === null || daysBetween(row.priceDate, todayIso) > STALE_NAV_DAYS) stale.add(row.instrumentId);
  }
  return [...stale];
}
