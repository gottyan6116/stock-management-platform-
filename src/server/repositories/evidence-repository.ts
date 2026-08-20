import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ResearchImportInput } from "@/lib/evidence/schemas";

type ResearchReportRow = Database["public"]["Tables"]["research_reports"]["Row"];
type ResearchSourceInsert = Database["public"]["Tables"]["research_sources"]["Insert"];

export interface ResearchReportSummary {
  id: string;
  importMode: ResearchReportRow["import_mode"];
  researchDate: string | null;
  researchModel: string | null;
  summary: string | null;
  importedAt: string;
  sourceName: string | null;
  sourceType: Database["public"]["Tables"]["research_sources"]["Row"]["source_type"] | null;
}

export interface InsertPasteReportParams {
  userId: string;
  instrumentId: string;
  sourceName: string;
  sourceType: Database["public"]["Tables"]["research_sources"]["Row"]["source_type"];
  sourceUrl?: string;
  researchModel?: string;
  rawContent: string;
  userNotes?: string;
}

/** 貼り付けテキスト（未構造化）の取り込み。sources 1件 + research_reports 1件のみ作成し、構造化evidenceは作らない。 */
export async function insertPasteReport(
  supabase: SupabaseClient<Database>,
  params: InsertPasteReportParams
): Promise<ResearchReportRow> {
  const { data: source, error: sourceError } = await supabase
    .from("research_sources")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      source_type: params.sourceType,
      source_name: params.sourceName,
      source_url: params.sourceUrl,
    })
    .select()
    .single();
  if (sourceError) throw sourceError;

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      source_id: source.id,
      import_mode: "paste_text",
      research_model: params.researchModel,
      raw_content: params.rawContent,
      user_notes: params.userNotes,
    })
    .select()
    .single();
  if (reportError) throw reportError;

  return report;
}

/** 構造化JSON（ResearchImportSchema検証済み）の取り込み。sources → research_reports → 各evidenceテーブルへカスケードする。 */
export async function insertJsonImport(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string,
  input: ResearchImportInput
): Promise<{ reportId: string; sourcesCreated: number }> {
  const sourceKeyToId = new Map<string, string>();

  if (input.sources.length > 0) {
    const sourceRows: ResearchSourceInsert[] = input.sources.map((source) => ({
      user_id: userId,
      instrument_id: instrumentId,
      source_type: source.sourceType,
      source_name: source.sourceName,
      source_url: source.sourceUrl,
      evidence_class: source.evidenceClass,
      reliability: source.reliability,
    }));
    const { data: insertedSources, error: sourcesError } = await supabase
      .from("research_sources")
      .insert(sourceRows)
      .select("id");
    if (sourcesError) throw sourcesError;
    insertedSources.forEach((row, index) => {
      const sourceKey = input.sources[index]?.sourceKey;
      if (sourceKey) sourceKeyToId.set(sourceKey, row.id);
    });
  }

  const primarySourceId = input.sources.length > 0 ? (sourceKeyToId.values().next().value ?? null) : null;

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .insert({
      user_id: userId,
      instrument_id: instrumentId,
      source_id: primarySourceId,
      import_mode: "json",
      research_date: input.researchDate,
      raw_content: JSON.stringify(input),
      structured_json: input,
      summary: input.summary,
    })
    .select()
    .single();
  if (reportError) throw reportError;

  const resolveSourceId = (sourceKey?: string) => (sourceKey ? (sourceKeyToId.get(sourceKey) ?? null) : null);

  if (input.financials.length > 0) {
    const { error } = await supabase.from("financial_metrics").insert(
      input.financials.map((metric) => ({
        user_id: userId,
        instrument_id: instrumentId,
        metric_key: metric.metricKey,
        value: metric.value,
        unit: metric.unit,
        currency: metric.currency,
        period_type: metric.periodType,
        period_start: metric.periodStart,
        period_end: metric.periodEnd,
        reported_at: metric.reportedAt,
        source_id: resolveSourceId(metric.sourceKey),
        source_report_id: report.id,
        is_manual: false,
      }))
    );
    if (error) throw error;
  }

  if (input.managementStatements.length > 0) {
    const { error } = await supabase.from("management_statements").insert(
      input.managementStatements.map((statement) => ({
        user_id: userId,
        instrument_id: instrumentId,
        person_name: statement.personName,
        role: statement.role,
        statement: statement.statement,
        statement_date: statement.statementDate,
        topic: statement.topic,
        page: statement.page,
        confidence: statement.confidence,
        source_id: resolveSourceId(statement.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  if (input.catalysts.length > 0) {
    const { error } = await supabase.from("company_catalysts").insert(
      input.catalysts.map((catalyst) => ({
        user_id: userId,
        instrument_id: instrumentId,
        catalyst_type: catalyst.catalystType,
        description: catalyst.description,
        expected_timing: catalyst.expectedTiming,
        impact: catalyst.impact,
        source_id: resolveSourceId(catalyst.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  if (input.risks.length > 0) {
    const { error } = await supabase.from("company_risks").insert(
      input.risks.map((risk) => ({
        user_id: userId,
        instrument_id: instrumentId,
        risk_type: risk.riskType,
        description: risk.description,
        severity: risk.severity,
        likelihood: risk.likelihood,
        detected_at: risk.detectedAt,
        source_id: resolveSourceId(risk.sourceKey),
      }))
    );
    if (error) throw error;
  }

  if (input.investorOpinions.length > 0) {
    const { error } = await supabase.from("research_opinions").insert(
      input.investorOpinions.map((opinion) => ({
        user_id: userId,
        instrument_id: instrumentId,
        author: opinion.author,
        organization: opinion.organization,
        stance: opinion.stance,
        summary: opinion.summary,
        rating: opinion.rating,
        target_price: opinion.targetPrice,
        published_at: opinion.publishedAt,
        source_url: opinion.sourceUrl,
        source_id: resolveSourceId(opinion.sourceKey),
      }))
    );
    if (error) throw error;
  }

  if (input.events.length > 0) {
    const { error } = await supabase.from("company_events").insert(
      input.events.map((event) => ({
        user_id: userId,
        instrument_id: instrumentId,
        event_type: event.eventType,
        title: event.title,
        description: event.description,
        event_date: event.eventDate,
        source_id: resolveSourceId(event.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  return { reportId: report.id, sourcesCreated: input.sources.length };
}

/** 銘柄に紐づく取り込み済みレポート一覧を新しい順で返す。表示用にsourceを1段joinする。 */
export async function listResearchReports(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ResearchReportSummary[]> {
  const { data, error } = await supabase
    .from("research_reports")
    .select("id, import_mode, research_date, research_model, summary, imported_at, research_sources(source_name, source_type)")
    .eq("instrument_id", instrumentId)
    .order("imported_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    importMode: row.import_mode,
    researchDate: row.research_date,
    researchModel: row.research_model,
    summary: row.summary,
    importedAt: row.imported_at,
    sourceName: row.research_sources?.source_name ?? null,
    sourceType: row.research_sources?.source_type ?? null,
  }));
}
