import type { EvaluatedPosition } from "@/features/portfolio/types";
import { toJpy, type FxRate } from "./valuation";

/** 新NISA（2024年〜）の上限（円）。 */
export const NISA_LIMITS = {
  annualTsumitate: 1_200_000,
  annualGrowth: 2_400_000,
  annualTotal: 3_600_000,
  lifetimeTotal: 18_000_000,
  lifetimeGrowth: 12_000_000,
} as const;

export interface PurchaseLike {
  nisaType: "tsumitate" | "growth" | null;
  side: "buy" | "sell";
  tradedOn: string;
  amountJpy: number;
}

export interface AnnualUsage {
  tsumitate: number;
  growth: number;
  total: number;
  /** 対象年に記録された買付の件数。0なら「未記録」と「本当に0円」を区別できない。 */
  recordCount: number;
}

/** 年間投資枠の消化額。買付のみ数える（売却しても同じ年の枠は戻らない）。課税口座は対象外。 */
export function annualUsage(purchases: readonly PurchaseLike[], year: number): AnnualUsage {
  const usage: AnnualUsage = { tsumitate: 0, growth: 0, total: 0, recordCount: 0 };
  for (const p of purchases) {
    if (p.side !== "buy" || p.nisaType === null) continue;
    if (Number(p.tradedOn.slice(0, 4)) !== year) continue;
    usage[p.nisaType] += p.amountJpy;
    usage.total += p.amountJpy;
    usage.recordCount += 1;
  }
  return usage;
}

export interface LifetimeUsage {
  total: number;
  growth: number;
  /** 取得単価が無い、または円換算できず、簿価に含められなかった保有件数。 */
  unknownCount: number;
}

/**
 * 生涯投資枠の使用額（簿価ベース）。売却すると簿価分の枠が復活するため、
 * 現在の保有の取得額（平均取得単価×数量）で数える。旧つみたてNISAは新制度の枠に含めない。
 */
export function lifetimeBookValue(
  rows: readonly Pick<EvaluatedPosition, "nisaType" | "nisaLegacy" | "costBasis" | "currency">[],
  fx: FxRate | null
): LifetimeUsage {
  const usage: LifetimeUsage = { total: 0, growth: 0, unknownCount: 0 };
  for (const row of rows) {
    if (row.nisaType === null || row.nisaLegacy) continue;
    const cost = toJpy(row.costBasis, row.currency, fx);
    if (cost === null) {
      usage.unknownCount += 1;
      continue;
    }
    usage.total += cost;
    if (row.nisaType === "growth") usage.growth += cost;
  }
  return usage;
}
