import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { recordSnapshotForUser } from "@/server/services/record-snapshot";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron から1日1回呼ばれる。Vercel は環境変数 CRON_SECRET を
 * `Authorization: Bearer <secret>` として付けて送る。それ以外の呼び出しは拒否する。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { data, error } = await createServiceRoleClient().from("positions").select("user_id");
  if (error) return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
  const results: Record<string, string> = {};
  for (const userId of userIds) {
    try {
      const outcome = await recordSnapshotForUser(userId);
      results[userId] = outcome.status === "recorded" ? "recorded" : `skipped:${outcome.reason}`;
    } catch {
      results[userId] = "failed";
    }
  }
  return NextResponse.json({ data: { users: userIds.length, results } });
}
