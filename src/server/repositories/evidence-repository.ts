import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ResearchImportInput } from "@/lib/evidence/schemas";

type ResearchReportRow = Database["public"]["Tables"]["research_reports"]["Row"];

// PostgRESTの配列（複数行）insertは、行オブジェクトに存在するキー（値がundefinedでも）を
// すべて ?columns= に含めてしまい、そのキーはbodyから省略されるため、DBはNULLを受け取り
// column defaultをバイパスする（単一行insertはこの経路を通らないため影響しない）。
// { defaultToNull: false } を付けると Prefer: missing=default が送られ、
// 省略されたキーにcolumn defaultが正しく適用される。P3以降で配列insertを追加する際も必ず付けること。
const BULK_INSERT_OPTIONS = { defaultToNull: false } as const;

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

  // sourcesは通常1〜数件程度のため、順序依存の一括insertではなく1件ずつ単一行insertする
  // （sourceKey→idの対応付けを行順序の暗黙的な保証に頼らないため）。
  for (const source of input.sources) {
    const { data: insertedSource, error: sourceError } = await supabase
      .from("research_sources")
      .insert({
        user_id: userId,
        instrument_id: instrumentId,
        source_type: source.sourceType,
        source_name: source.sourceName,
        source_url: source.sourceUrl,
        evidence_class: source.evidenceClass ?? "fact",
        reliability: source.reliability,
      })
      .select("id")
      .single();
    if (sourceError) throw sourceError;
    sourceKeyToId.set(source.sourceKey, insertedSource.id);
  }

  const primarySourceId = input.sources.length > 0 ? (sourceKeyToId.get(input.sources[0]!.sourceKey) ?? null) : null;

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
      })),
      BULK_INSERT_OPTIONS
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
      })),
      BULK_INSERT_OPTIONS
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
      })),
      BULK_INSERT_OPTIONS
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
        source_report_id: report.id,
      })),
      BULK_INSERT_OPTIONS
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
        source_report_id: report.id,
      })),
      BULK_INSERT_OPTIONS
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
      })),
      BULK_INSERT_OPTIONS
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

type FinancialMetricRow = Database["public"]["Tables"]["financial_metrics"]["Row"];

export interface InsertManualMetricParams {
  userId: string;
  instrumentId: string;
  metricKey: FinancialMetricRow["metric_key"];
  value: number;
  unit?: string;
  currency?: "JPY" | "USD";
  periodType: "FY" | "Q";
  periodStart: string;
  periodEnd: string;
  reportedAt?: string;
}

/** 手入力の財務指標を1件保存する。source_id/source_report_idは常にnull（インポートされたレポートに由来しないため）。 */
export async function insertManualMetric(
  supabase: SupabaseClient<Database>,
  params: InsertManualMetricParams
): Promise<FinancialMetricRow> {
  const { data, error } = await supabase
    .from("financial_metrics")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      metric_key: params.metricKey,
      value: params.value,
      unit: params.unit,
      currency: params.currency,
      period_type: params.periodType,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      reported_at: params.reportedAt,
      is_manual: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** 銘柄に紐づく財務指標を期間の新しい順で返す（手入力・インポート両方を含む）。 */
export async function listFinancialMetrics(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<FinancialMetricRow[]> {
  const { data, error } = await supabase
    .from("financial_metrics")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type ManagementStatementRow = Database["public"]["Tables"]["management_statements"]["Row"];
type CompanyCatalystRow = Database["public"]["Tables"]["company_catalysts"]["Row"];
type CompanyRiskRow = Database["public"]["Tables"]["company_risks"]["Row"];
type CompanyEventRow = Database["public"]["Tables"]["company_events"]["Row"];
type ResearchOpinionRow = Database["public"]["Tables"]["research_opinions"]["Row"];

/** 銘柄に紐づく経営者・投資家発言を発言日の新しい順で返す（発言日未設定はcreated_atで補完）。 */
export async function listManagementStatements(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ManagementStatementRow[]> {
  const { data, error } = await supabase
    .from("management_statements")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("statement_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくカタリスト（好材料）を登録日の新しい順で返す。 */
export async function listCompanyCatalysts(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyCatalystRow[]> {
  const { data, error } = await supabase
    .from("company_catalysts")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくリスクを検知日の新しい順で返す（検知日未設定はcreated_atで補完）。 */
export async function listCompanyRisks(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyRiskRow[]> {
  const { data, error } = await supabase
    .from("company_risks")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("detected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくイベント（決算・M&A等）をイベント日の新しい順で返す。 */
export async function listCompanyEvents(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyEventRow[]> {
  const { data, error } = await supabase
    .from("company_events")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づく投資家・アナリスト意見を公表日の新しい順で返す（公表日未設定はcreated_atで補完）。 */
export async function listResearchOpinions(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ResearchOpinionRow[]> {
  const { data, error } = await supabase
    .from("research_opinions")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type ResearchSourceRow = Database["public"]["Tables"]["research_sources"]["Row"];

/**
 * 銘柄に紐づく情報源（research_sources）を新しい順で返す。
 * 各evidence行のsource_idはこの一覧の行を指しており、evidence_class（fact/opinion/ai_interpretation）で
 * 「事実か意見かAIの解釈か」を区別できる。Evidence Builder経由でAIプロンプトに渡すことで、
 * どの発言・数値がどの情報源に基づくかをAI自身が参照できるようにする。
 */
export async function listResearchSources(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ResearchSourceRow[]> {
  const { data, error } = await supabase
    .from("research_sources")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type AnalysisRunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

/** 銘柄に紐づく最新のAI分析結果を1件返す（無ければnull）。「AI分析」タブの初期表示・再訪時の表示に使う。 */
export async function getLatestAnalysisRun(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<AnalysisRunRow | null> {
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
