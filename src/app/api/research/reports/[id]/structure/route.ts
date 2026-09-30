import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { structureResearchReport } from "@/server/services/structure-research-report";

// cloudflare-provider.tsのfetchタイムアウト（既定60秒）より前にVercelがFunctionを強制終了しないよう、
// src/app/api/analysis/run/route.tsと同じ理由で明示的に延長する。
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const outcome = await structureResearchReport(supabase, user.id, params.id);
  switch (outcome.status) {
    case "structured":
      return NextResponse.json({ data: { reportId: outcome.reportId, sourcesCreated: outcome.sourcesCreated } });
    case "not_found":
      return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");
    case "unsupported_mode":
      return apiError("INVALID_REQUEST", "貼り付けモードの資料のみAI構造化できます。");
    case "failed":
      console.error("POST /api/research/reports/[id]/structure failed:", outcome.error);
      return apiError("INTERNAL_ERROR");
  }
}
