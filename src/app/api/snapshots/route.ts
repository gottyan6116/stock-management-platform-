import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { recordSnapshotForUser } from "@/server/services/record-snapshot";

/** 自分のスナップショット履歴（古い順）。RLSにより本人の行だけが返る。 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 365, 1), 3650);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, total_value_jpy, total_cost_jpy, is_estimated")
    .eq("user_id", user.id)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });
  if (error) return apiError("INTERNAL_ERROR");

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      date: row.snapshot_date,
      totalValueJpy: Number(row.total_value_jpy),
      totalCostJpy: row.total_cost_jpy === null ? null : Number(row.total_cost_jpy),
      isEstimated: row.is_estimated,
    })),
  });
}

/**
 * 今日の分を記録する（ホームを開いたときに、cronを待たず履歴を始めるため）。
 * 金額はクライアントから受け取らず、サーバーが保有と価格から計算する。
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    return NextResponse.json({ data: await recordSnapshotForUser(user.id) });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
