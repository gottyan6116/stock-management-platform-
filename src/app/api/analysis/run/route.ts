import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import {
  listFinancialMetrics,
  listManagementStatements,
  listCompanyCatalysts,
  listCompanyRisks,
  listCompanyEvents,
  listResearchOpinions,
  listResearchReports,
  listResearchSources,
} from "@/server/repositories/evidence-repository";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";
import { computeEvidenceHash } from "@/lib/evidence/hash";
import { computeQuantScore } from "@/lib/scoring/quant-score";
import { getInvestmentAnalysisProvider } from "@/lib/ai/investment-analysis/get-provider";
import { structureResearchReport } from "@/server/services/structure-research-report";

// Cloudflare Workers AIの生成に数十秒かかることがあり（cloudflare-provider.tsのfetchタイムアウトは60秒）、
// Vercelの既定のFunction実行時間（Hobby: 10秒 / Pro: 15秒）ではその前にプラットフォーム側に強制終了され、
// analysis_runsへの保存もエラーハンドリングも行われないまま生の504になってしまう。明示的に延長する。
// 分析本体のAI呼び出しに加え、未構造化レポートの自動構造化（最大MAX_AUTO_STRUCTURE_PER_RUN件・並列）も
// この中で行うため、P6時点の60秒から余裕を持たせている。
export const maxDuration = 90;

// 1回の分析実行で自動構造化するpaste_textレポートの上限。無制限にすると銘柄によっては
// maxDurationを超えかねないため、超過分は次回の分析実行または手動の「AIで構造化」ボタンに委ねる。
const MAX_AUTO_STRUCTURE_PER_RUN = 2;

const requestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
});

const ANALYSIS_VERSION = "p6-v1";
const SCORING_VERSION = "quant-v1";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  // 手入力ファンド（provider='manual'）は大文字小文字を区別する生のprovider_symbolで登録されており、
  // resolveOrCreateInstrumentはprovider='yahoo'固定・シンボルを大文字化してしまうため一致しない
  // （src/app/api/research/import/route.ts、src/app/api/research/metrics/route.ts の同種コメント参照）。
  const manualInstrument = await findInstrumentByProviderSymbol(supabase, parsed.data.providerSymbol, "manual").catch(
    () => null
  );

  let companySnapshot: CompanySnapshot;
  let marketSnapshot: MarketSnapshot;
  let instrumentId: string;

  if (manualInstrument) {
    instrumentId = manualInstrument.id;
    companySnapshot = {
      instrumentId: manualInstrument.id,
      providerSymbol: manualInstrument.provider_symbol,
      name: manualInstrument.name,
      exchange: manualInstrument.exchange,
      market: manualInstrument.market,
      currency: manualInstrument.currency,
      sector: manualInstrument.sector,
      industry: manualInstrument.industry,
    };
    // 手入力ファンドはYahoo等のリアルタイム相場を持たない（基準価額は別途手入力管理）。
    marketSnapshot = {
      priceDate: null,
      close: null,
      previousClose: null,
      change: null,
      changePercent: null,
      dividendYield: null,
      trailingPE: null,
      marketCap: null,
    };
  } else {
    const providerSymbol = normalizeProviderSymbol(parsed.data.providerSymbol);
    // research/import・research/metricsの各routeと異なり、ここは既知銘柄の再分析が主用途のため、
    // 未知銘柄のときだけYahooへ問い合わせるresolveOrCreateInstrumentを先に呼ぶ。
    // 既知銘柄はDBヒットのみで解決でき、Yahoo側の一時的な障害やレート制限がある場合でも
    // ローカルに蓄積済みのevidenceだけで分析を実行できる。
    const instrument = await resolveOrCreateInstrument(providerSymbol).catch(() => null);
    if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");
    instrumentId = instrument.id;

    const provider = getMarketDataProvider();
    const quote = await provider.getQuote(providerSymbol).catch(() => null);

    companySnapshot = {
      instrumentId: instrument.id,
      providerSymbol: instrument.provider_symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      market: instrument.market,
      currency: instrument.currency,
      sector: instrument.sector,
      industry: instrument.industry,
    };
    marketSnapshot = {
      priceDate: quote?.priceDate ?? null,
      close: quote?.close ?? null,
      previousClose: quote?.previousClose ?? null,
      change: quote?.change ?? null,
      changePercent: quote?.changePercent ?? null,
      dividendYield: quote?.dividendYield ?? null,
      trailingPE: quote?.trailingPE ?? null,
      marketCap: quote?.marketCap ?? null,
    };
  }

  try {
    // 貼り付け（paste_text）のまま未構造化のレポートがあると、決算・財務や開示・発言の各tabにも
    // financial_metrics等の実データとして反映されず、AI分析も「データ不足」と誤って報告してしまう
    // （生テキストの抜粋はprompt.ts側で読めるが、定量スコアや他タブへは反映されない）。
    // 分析前に自動でAI構造化することで、ユーザーが個別に「AIで構造化」を押さなくても
    // リサーチタブに貼り付けた内容が全体に反映されるようにする。1件失敗しても分析自体は継続する
    // （raw_content抜粋へのフォールバックが既にprompt.ts側にある）。
    const reportsBeforeStructuring = await listResearchReports(supabase, instrumentId).catch(() => []);
    const unstructuredReports = reportsBeforeStructuring
      .filter((r) => r.importMode === "paste_text")
      .slice(0, MAX_AUTO_STRUCTURE_PER_RUN);
    if (unstructuredReports.length > 0) {
      const outcomes = await Promise.allSettled(
        unstructuredReports.map((r) => structureResearchReport(supabase, user.id, r.id))
      );
      outcomes.forEach((outcome, i) => {
        if (outcome.status === "rejected") {
          console.error(`auto-structure failed for report ${unstructuredReports[i]!.id}:`, outcome.reason);
        } else if (outcome.value.status === "failed") {
          console.error(`auto-structure failed for report ${unstructuredReports[i]!.id}:`, outcome.value.error);
        }
      });
    }

    const [financials, managementStatements, catalysts, risks, events, opinions, research, sources] = await Promise.all([
      listFinancialMetrics(supabase, instrumentId),
      listManagementStatements(supabase, instrumentId),
      listCompanyCatalysts(supabase, instrumentId),
      listCompanyRisks(supabase, instrumentId),
      listCompanyEvents(supabase, instrumentId),
      listResearchOpinions(supabase, instrumentId),
      listResearchReports(supabase, instrumentId),
      listResearchSources(supabase, instrumentId),
    ]);

    const evidence = buildInvestmentEvidence({
      company: companySnapshot,
      market: marketSnapshot,
      sources: sources.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        sourceType: row.source_type,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        evidenceClass: row.evidence_class,
        reliability: row.reliability,
        researchedAt: row.researched_at,
        createdAt: row.created_at,
      })),
      financials: financials.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        metricKey: row.metric_key,
        value: row.value,
        unit: row.unit,
        currency: row.currency,
        periodType: row.period_type,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        reportedAt: row.reported_at,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        isManual: row.is_manual,
        createdAt: row.created_at,
      })),
      managementStatements: managementStatements.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        personName: row.person_name,
        role: row.role,
        statement: row.statement,
        statementDate: row.statement_date,
        topic: row.topic,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        page: row.page,
        confidence: row.confidence,
        createdAt: row.created_at,
      })),
      catalysts: catalysts.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        catalystType: row.catalyst_type,
        description: row.description,
        expectedTiming: row.expected_timing,
        impact: row.impact,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        createdAt: row.created_at,
      })),
      risks: risks.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        riskType: row.risk_type,
        description: row.description,
        severity: row.severity,
        likelihood: row.likelihood,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        detectedAt: row.detected_at,
        createdAt: row.created_at,
      })),
      events: events.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        eventType: row.event_type,
        title: row.title,
        description: row.description,
        eventDate: row.event_date,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        createdAt: row.created_at,
      })),
      opinions: opinions.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        author: row.author,
        organization: row.organization,
        stance: row.stance,
        summary: row.summary,
        rating: row.rating,
        targetPrice: row.target_price,
        publishedAt: row.published_at,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        sourceUrl: row.source_url,
        reliability: row.reliability,
        createdAt: row.created_at,
      })),
      research,
    });

    const quantScore = computeQuantScore(evidence.financials);
    const evidenceHash = computeEvidenceHash(evidence);

    const provider = getInvestmentAnalysisProvider();
    const analysis = await provider.analyzeInvestment(evidence, quantScore);

    const { data: run, error: insertError } = await supabase
      .from("analysis_runs")
      .insert({
        user_id: user.id,
        instrument_id: instrumentId,
        model: provider.modelName,
        analysis_version: ANALYSIS_VERSION,
        scoring_version: SCORING_VERSION,
        // quantScoreの内訳（カテゴリ別スコア・満点・算出根拠）はanalysis_runsに専用列を持たないため、
        // input_snapshot（jsonb、形状を強制されない）に同居させる。UI側の「スコアの内訳」表示が
        // これを読む。マイグレーションを増やさずに済ませるための意図的な選択（P8）。
        input_snapshot: { ...evidence, quantScore },
        evidence_hash: evidenceHash,
        quant_score: quantScore.total,
        medium_score: analysis.mediumTerm.score,
        long_score: analysis.longTerm.score,
        confidence: analysis.confidence,
        result_json: analysis,
        status: "success",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ data: { analysisRunId: run.id, quantScore, analysis } });
  } catch (err) {
    console.error("POST /api/analysis/run failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
