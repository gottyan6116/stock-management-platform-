import { evaluatePositions } from "@/features/portfolio/summary";
import { buildSnapshot } from "@/lib/portfolio/snapshot";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { todayJst } from "@/lib/utils/format";
import { getUsdJpy } from "./fx";
import { buildPositionItems } from "./position-items";

export type RecordOutcome =
  | { status: "recorded"; date: string; totalValueJpy: number }
  | { status: "skipped"; reason: "no-holdings" | "incomplete" };

/**
 * 今日の評価額を portfolio_snapshots に1行記録する（同じ日は上書き＝冪等）。
 * 価格・為替が欠けて合計が不完全な日は記録しない（履歴に偽の急落を残さない）。
 * 書き込みは service role のみ（テーブルに書き込みポリシーは無い）。
 */
export async function recordSnapshotForUser(userId: string): Promise<RecordOutcome> {
  const service = createServiceRoleClient();
  const [items, fx] = await Promise.all([buildPositionItems(service, userId), getUsdJpy()]);

  const outcome = buildSnapshot(evaluatePositions(items), fx);
  if (!outcome.ok) return { status: "skipped", reason: outcome.reason };

  const date = todayJst();
  const { record } = outcome;
  const { error } = await service.from("portfolio_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: date,
      total_value_jpy: record.totalValueJpy,
      total_cost_jpy: record.totalCostJpy,
      usd_jpy: record.usdJpy,
      breakdown: record.breakdown,
      is_estimated: false,
    },
    { onConflict: "user_id,snapshot_date" }
  );
  if (error) throw error;
  return { status: "recorded", date, totalValueJpy: record.totalValueJpy };
}
