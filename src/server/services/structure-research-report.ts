import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { findInstrumentById } from "@/server/repositories/instruments-repository";
import { deleteResearchReport, insertJsonImport } from "@/server/repositories/evidence-repository";
import { getResearchStructuringProvider } from "@/lib/ai/research-structuring/get-provider";

export type StructureReportOutcome =
  | { status: "structured"; reportId: string; sourcesCreated: number }
  | { status: "not_found" }
  | { status: "unsupported_mode" }
  | { status: "failed"; error: unknown };

/**
 * 貼り付け（paste_text）モードのレポートをAIで構造化し、json-mode importとして置き換える。
 * src/app/api/research/reports/[id]/structure/route.tsのユーザー操作起点の構造化と、
 * src/app/api/analysis/run/route.tsのAI分析実行時の自動構造化の両方から呼ばれる共通ロジック。
 * HTTPステータスコードやapiError()には関与しない（呼び出し側がstatusを見て判断する）。
 */
export async function structureResearchReport(
  supabase: SupabaseClient<Database>,
  userId: string,
  reportId: string
): Promise<StructureReportOutcome> {
  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .select(
      "id, instrument_id, import_mode, research_date, raw_content, imported_at, research_sources(source_name, source_type)"
    )
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (reportError) return { status: "failed", error: reportError };
  if (!report) return { status: "not_found" };
  if (report.import_mode !== "paste_text") return { status: "unsupported_mode" };

  const instrument = await findInstrumentById(supabase, report.instrument_id).catch(() => null);
  if (!instrument) return { status: "not_found" };

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

    const deleted = await deleteResearchReport(supabase, userId, report.id);
    if (!deleted) return { status: "not_found" };

    const result = await insertJsonImport(supabase, userId, report.instrument_id, structured);
    return { status: "structured", reportId: result.reportId, sourcesCreated: result.sourcesCreated };
  } catch (err) {
    return { status: "failed", error: err };
  }
}
