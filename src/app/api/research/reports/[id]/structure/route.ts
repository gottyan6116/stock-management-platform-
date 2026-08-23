import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { findInstrumentById } from "@/server/repositories/instruments-repository";
import { deleteResearchReport, insertJsonImport } from "@/server/repositories/evidence-repository";
import { getResearchStructuringProvider } from "@/lib/ai/research-structuring/get-provider";

// cloudflare-provider.tsのfetchタイムアウト（既定60秒）より前にVercelがFunctionを強制終了しないよう、
// src/app/api/analysis/run/route.tsと同じ理由で明示的に延長する。
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .select(
      "id, instrument_id, import_mode, research_date, raw_content, imported_at, research_sources(source_name, source_type)"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (reportError) {
    console.error("POST /api/research/reports/[id]/structure failed (fetch report):", reportError);
    return apiError("INTERNAL_ERROR");
  }
  if (!report) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");
  if (report.import_mode !== "paste_text") {
    return apiError("INVALID_REQUEST", "貼り付けモードの資料のみAI構造化できます。");
  }

  const instrument = await findInstrumentById(supabase, report.instrument_id).catch(() => null);
  if (!instrument) return apiError("NOT_FOUND", "紐づく銘柄が見つかりませんでした。");

  try {
    const provider = getResearchStructuringProvider();
    const structured = await provider.structureResearch({
      rawContent: report.raw_content,
      company: {
        ticker: instrument.provider_symbol,
        name: instrument.name,
        // 手入力ファンド（provider='manual'）はexchangeが未設定のことがある。company.exchangeは
        // ResearchImportSchemaで必須（最小1文字）のため、instrument.marketから妥当な既定値を補う
        // （リサーチ内容の捏造ではなく、既にDBにある構造メタデータからの補完）。
        exchange: instrument.exchange ?? (instrument.market === "JP" ? "Tokyo" : "US Market"),
      },
      researchDate: report.research_date ?? report.imported_at.slice(0, 10),
      // paste_textはinsertPasteReportで必ずsource_idを持つはずだが、防御的にフォールバックする。
      knownSource: report.research_sources
        ? { sourceName: report.research_sources.source_name, sourceType: report.research_sources.source_type }
        : { sourceName: "不明な情報源", sourceType: "other" },
    });

    const deleted = await deleteResearchReport(supabase, user.id, report.id);
    if (!deleted) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");

    const result = await insertJsonImport(supabase, user.id, report.instrument_id, structured);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/research/reports/[id]/structure failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
