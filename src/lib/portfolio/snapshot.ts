import type { EvaluatedPosition } from "@/features/portfolio/types";
import { allocate, summarizePortfolioJpy, type FxRate } from "./valuation";

export interface SnapshotRecord {
  totalValueJpy: number;
  totalCostJpy: number | null;
  usdJpy: number | null;
  /** 口座別・資産クラス別の評価額（円）。キーは valuation の AccountKey / AssetClass。 */
  breakdown: { account: Record<string, number>; assetClass: Record<string, number> };
}

export type SnapshotOutcome =
  | { ok: true; record: SnapshotRecord }
  | { ok: false; reason: "no-holdings" | "incomplete" };

/**
 * 保有の評価結果から1日分のスナップショットを作る。
 * 価格取得やドル円が欠けて合計から外れた保有がある場合は「記録しない」。
 * 欠けた分だけ低い値を履歴に残すと、推移グラフが偽の急落を示してしまうため。
 */
export function buildSnapshot(rows: readonly EvaluatedPosition[], fx: FxRate | null): SnapshotOutcome {
  if (rows.length === 0) return { ok: false, reason: "no-holdings" };

  const summary = summarizePortfolioJpy(rows, fx);
  if (summary.totalValueJpy === null) return { ok: false, reason: "no-holdings" };
  if (summary.excludedCount > 0) return { ok: false, reason: "incomplete" };

  const toRecord = (dimension: "account" | "assetClass") =>
    Object.fromEntries(allocate(rows, fx, dimension).map((slice) => [slice.key, Math.round(slice.valueJpy)]));

  return {
    ok: true,
    record: {
      totalValueJpy: Math.round(summary.totalValueJpy),
      totalCostJpy: summary.costBasisJpy === null ? null : Math.round(summary.costBasisJpy),
      usdJpy: fx?.usdJpy ?? null,
      breakdown: { account: toRecord("account"), assetClass: toRecord("assetClass") },
    },
  };
}
