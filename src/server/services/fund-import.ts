import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { planFundImport, type ImportPlan } from "@/lib/import/plan-fund-import";
import type { FundCsvRow } from "@/lib/import/rakuten-fund-csv";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { addFavorite } from "@/server/repositories/favorites-repository";
import { upsertManualFundPrice } from "@/server/repositories/manual-fund-prices-repository";
import { listPositions } from "@/server/repositories/positions-repository";
import { resolveOrCreateManualFundInstrument } from "@/server/services/resolve-instrument";

export async function buildFundImportPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: FundCsvRow[]
): Promise<ImportPlan> {
  const positions = (await listPositions(supabase, userId)).filter(
    (p) => p.isManual && p.instrument.instrument_type === "fund"
  );

  // instrumentsは共有テーブル。手入力ファンド（provider='manual'）だけを名前照合の候補にする。
  const { data: instruments, error } = await createServiceRoleClient()
    .from("instruments")
    .select("id, name")
    .eq("provider", "manual")
    .eq("instrument_type", "fund");
  if (error) throw error;

  return planFundImport(
    rows,
    instruments ?? [],
    positions.map((p) => ({
      id: p.id,
      instrumentId: p.instrument.id,
      nisaType: p.nisaType,
      quantity: p.quantity,
      avgCost: p.avgCost,
      manualUnitPrice: p.manualUnitPrice,
    }))
  );
}

export interface ApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  failed: { name: string; reason: string }[];
}

/**
 * 計画を反映する。「変更なし」の行は書かない。CSVに無い保有は触らない（削除しない）。
 * トランザクションではないため、失敗した行は failed に残し、成功した行はそのまま反映される。
 */
export async function applyFundImportPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: ImportPlan,
  asOf: string
): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, unchanged: 0, failed: [] };
  const service = createServiceRoleClient();

  for (const item of plan.items) {
    if (item.action === "unchanged") {
      result.unchanged += 1;
      continue;
    }
    const { row } = item;
    try {
      const instrumentId = item.instrumentId ?? (await resolveOrCreateManualFundInstrument(row.name)).id;

      // CSVで読めなかった値(null)で既存の値を消さない。
      const values = {
        quantity: row.quantity,
        ...(row.avgCostPer10k !== null ? { avg_cost: row.avgCostPer10k } : {}),
        ...(row.nav !== null ? { manual_unit_price: row.nav, manual_price_date: asOf } : {}),
      };

      if (item.positionId) {
        const { error } = await supabase
          .from("positions")
          .update(values)
          .eq("user_id", userId)
          .eq("id", item.positionId);
        if (error) throw error;
        result.updated += 1;
      } else {
        const { error } = await supabase.from("positions").insert({
          user_id: userId,
          instrument_id: instrumentId,
          nisa_type: row.nisaType,
          is_manual: true,
          ...values,
        });
        if (error) throw error;
        await addFavorite(supabase, userId, instrumentId).catch((e: { code?: string }) => {
          if (e.code !== "23505") throw e;
        });
        result.created += 1;
      }

      if (row.nav !== null) await upsertManualFundPrice(service, instrumentId, row.nav, asOf);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "保存に失敗しました";
      result.failed.push({ name: row.name, reason });
    }
  }

  return result;
}
