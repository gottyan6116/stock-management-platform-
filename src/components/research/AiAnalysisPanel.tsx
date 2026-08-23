"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { formatDateTime } from "@/lib/utils/format";
import type { InvestmentAnalysisResult } from "@/lib/ai/investment-analysis/response";
import { METRIC_KEY_LABEL } from "./ManualMetricForm";

type AnalysisRunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

// src/lib/scoring/quant-score.ts: maxTotal is always 70 (fixed sum of the 6 sub-category maxes),
// but analysis_runs only persists the total, not the breakdown -- so the max is hardcoded here to
// match that invariant rather than recomputed from data we don't have at display time.
const QUANT_SCORE_MAX = 70;

interface StoredCategoryScore {
  score: number | null;
  maxScore: number;
  reason: string;
}

interface StoredQuantScore {
  growth: StoredCategoryScore;
  profitability: StoredCategoryScore;
  financialHealth: StoredCategoryScore;
  cashFlow: StoredCategoryScore;
  valuation: StoredCategoryScore;
  shareholderReturn: StoredCategoryScore;
}

interface StoredDataCoverage {
  financials: number;
  management: number;
  catalysts: number;
  risks: number;
  events: number;
  opinions: number;
  research: number;
}

interface StoredFinancialMetric {
  metricKey: string;
  value: number;
  periodType: "FY" | "Q";
  periodEnd: string;
}

/**
 * analysis_runs.input_snapshotは新設のquantScore/dataCoverageキーを持たない古い行もあり得る
 * （マイグレーション無しでjsonbに追記しただけのため）。すべて任意扱いで安全に読む。
 */
function readInputSnapshot(run: AnalysisRunRow): {
  quantScore: StoredQuantScore | null;
  dataCoverage: StoredDataCoverage | null;
  financials: StoredFinancialMetric[];
} {
  const snap = run.input_snapshot as Record<string, unknown> | null;
  if (!snap || typeof snap !== "object") return { quantScore: null, dataCoverage: null, financials: [] };
  return {
    quantScore: (snap.quantScore as StoredQuantScore | undefined) ?? null,
    dataCoverage: (snap.dataCoverage as StoredDataCoverage | undefined) ?? null,
    financials: Array.isArray(snap.financials) ? (snap.financials as StoredFinancialMetric[]) : [],
  };
}

const QUANT_CATEGORY_LABEL: Record<keyof StoredQuantScore, string> = {
  growth: "成長性",
  profitability: "収益性",
  financialHealth: "財務健全性",
  cashFlow: "キャッシュフロー",
  valuation: "バリュエーション",
  shareholderReturn: "株主還元",
};

const DATA_COVERAGE_LABEL: Record<keyof StoredDataCoverage, string> = {
  financials: "決算・財務",
  management: "経営陣発言",
  catalysts: "カタリスト",
  risks: "リスク",
  events: "重要発表・イベント",
  opinions: "アナリスト意見",
  research: "リサーチ資料",
};

// 推移グラフに使う指標の優先順位。売上高のように絶対額が大きく動く指標を優先し、
// 見つからなければ他の指標にフォールバックする。
const TREND_METRIC_PRIORITY: string[] = [
  "revenue",
  "operating_income",
  "net_income",
  "eps",
  "operating_margin",
  "net_margin",
];

interface TrendPoint {
  periodEnd: string;
  value: number;
}

/** 同一metricKey・同一periodTypeで2期分以上の値がある指標を優先順位に沿って探す。無ければnull。 */
function findTrendMetric(financials: StoredFinancialMetric[]): { metricKey: string; periodType: "FY" | "Q"; points: TrendPoint[] } | null {
  for (const metricKey of TREND_METRIC_PRIORITY) {
    for (const periodType of ["FY", "Q"] as const) {
      const matches = financials.filter((m) => m.metricKey === metricKey && m.periodType === periodType);
      const distinctPeriods = Array.from(new Set(matches.map((m) => m.periodEnd))).sort();
      if (distinctPeriods.length >= 2) {
        const points = distinctPeriods.map((periodEnd) => ({
          periodEnd,
          value: matches.find((m) => m.periodEnd === periodEnd)!.value,
        }));
        return { metricKey, periodType, points };
      }
    }
  }
  return null;
}

async function runAnalysis(providerSymbol: string) {
  const res = await fetch("/api/analysis/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerSymbol }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `analysis failed: ${res.status}`);
  }
  return res.json();
}

type Tone = "positive" | "info" | "neutral" | "negative" | "muted";

const TONE: Record<Tone, { ring: string; text: string; bg: string; border: string; dot: string }> = {
  positive: { ring: "var(--success)", text: "text-success-text", bg: "bg-success-soft", border: "border-success", dot: "bg-success" },
  info: { ring: "var(--primary)", text: "text-primary", bg: "bg-primary-soft", border: "border-primary", dot: "bg-primary" },
  neutral: { ring: "var(--warning)", text: "text-warning-text", bg: "bg-warning-soft", border: "border-warning", dot: "bg-warning" },
  negative: { ring: "var(--danger)", text: "text-danger-text", bg: "bg-danger-soft", border: "border-danger", dot: "bg-danger" },
  muted: { ring: "var(--border-strong)", text: "text-text-muted", bg: "bg-surface-subtle", border: "border-border", dot: "bg-border-strong" },
};

function scoreTone(score: number | null, max: number): Tone {
  if (score === null) return "muted";
  const pct = (score / max) * 100;
  if (pct >= 65) return "positive";
  if (pct >= 40) return "neutral";
  return "negative";
}

/** 0-100（または任意のmax）のスコアを円弧で示すリング。数値の大小を色と塗りの両方で即座に伝える。 */
function ScoreRing({ score, max, tone, size = 56, strokeWidth = 5 }: { score: number | null; max: number; tone: Tone; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? Math.min(1, Math.max(0, score / max)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      {score !== null ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE[tone].ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      ) : null}
    </svg>
  );
}

function ScoreTile({ label, score, max = 100, rating }: { label: string; score: number | null; max?: number; rating?: string | null }) {
  const tone = scoreTone(score, max);
  const s = TONE[tone];
  return (
    <div className={`rounded-card border p-3 ${s.border} ${s.bg}`}>
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <div className="mt-2 flex items-center gap-2.5">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <ScoreRing score={score} max={max} tone={tone} />
          <span className={`absolute text-sm font-bold tabular-nums ${s.text}`}>{score !== null ? Math.round(score) : "—"}</span>
        </div>
        {rating ? <p className={`text-sm font-semibold leading-tight ${s.text}`}>{rating}</p> : null}
      </div>
    </div>
  );
}

function CaseCard({ label, thesis, triggers, tone, glyph }: { label: string; thesis: string; triggers: string[]; tone: Tone; glyph: string }) {
  const s = TONE[tone];
  return (
    <div className={`rounded-card border-y border-r border-l-4 p-3 ${s.border} ${s.bg}`}>
      <p className={`flex items-center gap-1.5 text-xs font-bold ${s.text}`}>
        <span aria-hidden>{glyph}</span>
        {label}
      </p>
      <p className="mt-1.5 text-sm text-text-primary">{thesis}</p>
      {triggers.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-text-secondary">
          {triggers.map((t, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${s.dot}`} aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function InfoCard({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border p-3" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  );
}

function BulletList({ items, tone, emptyLabel }: { items: string[]; tone: Tone; emptyLabel: string }) {
  const s = TONE[tone];
  if (items.length === 0) {
    return <p className="mt-1 text-sm text-text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-1 space-y-1 text-sm text-text-primary">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * quant-score.tsのreasonは固定テンプレートの英語文字列（例: "operating_margin=11.75",
 * "no data (needs one of: current_ratio, net_debt_ebitda)"）。テンプレートは少数・固定なので、
 * パターンマッチで日本語表示に変換する。未知の形式が来た場合は元の文字列をそのまま表示する
 * （フォーマットが変わってもクラッシュしない安全側フォールバック）。
 */
function localizeQuantReason(reason: string): string {
  const noDataOneOf = reason.match(/^no data \(needs one of: (.+)\)$/);
  if (noDataOneOf) {
    const keys = noDataOneOf[1]!.split(", ").map((k) => METRIC_KEY_LABEL[k.trim() as keyof typeof METRIC_KEY_LABEL] ?? k.trim());
    return `データなし（${keys.join("・")}のいずれかが必要）`;
  }
  if (reason.startsWith("no data (needs revenue or eps")) {
    return "データなし（売上高またはEPSが同一期間タイプで2期分必要）";
  }
  const growthMatch = reason.match(/^(revenue|eps) YoY growth (-?[\d.]+)% \((FY|Q)\)$/);
  if (growthMatch) {
    const [, key, pct, periodType] = growthMatch;
    const label = METRIC_KEY_LABEL[key as keyof typeof METRIC_KEY_LABEL] ?? key;
    return `${label} 前年同期比 ${pct}%（${periodType === "FY" ? "通期" : "四半期"}）`;
  }
  if (/^[a-z_]+=-?[\d.]+/.test(reason)) {
    return reason
      .split(", ")
      .map((part) => {
        const [key, value] = part.split("=");
        if (!key || value === undefined) return part;
        return `${METRIC_KEY_LABEL[key as keyof typeof METRIC_KEY_LABEL] ?? key}=${value}`;
      })
      .join("、");
  }
  return reason;
}

function QuantBreakdownRow({ label, category }: { label: string; category: StoredCategoryScore }) {
  const tone = scoreTone(category.score, category.maxScore);
  const s = TONE[tone];
  const pct = category.score !== null ? Math.min(100, Math.max(0, (category.score / category.maxScore) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-text-secondary">{label}</p>
        <p className={`text-xs font-bold tabular-nums ${s.text}`}>
          {category.score !== null ? category.score.toFixed(1) : "—"} / {category.maxScore}
        </p>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`h-full rounded-full ${s.dot}`}
          style={{ width: `${pct}%`, transition: "width 0.6s ease" }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-text-muted">{localizeQuantReason(category.reason)}</p>
    </div>
  );
}

/** 定量スコアの内訳（6カテゴリ）を棒グラフで示す。algorithm-computedであることをUIで明示し、
 * AIの定性スコアとは別軸であることの根拠をユーザーが確認できるようにする。 */
function QuantScoreBreakdown({ quantScore }: { quantScore: StoredQuantScore }) {
  return (
    <div className="rounded-card border border-border p-3">
      <p className="text-xs font-semibold text-text-muted">
        定量スコアの内訳 <span className="font-normal text-text-muted">（コードによる自動算出・登録済み財務指標のみを使用）</span>
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {(Object.keys(QUANT_CATEGORY_LABEL) as (keyof StoredQuantScore)[]).map((key) => (
          <QuantBreakdownRow key={key} label={QUANT_CATEGORY_LABEL[key]} category={quantScore[key]} />
        ))}
      </div>
    </div>
  );
}

/** どの評価カテゴリにデータが接続済みかを一覧で示す。未接続を灰色で明示し、「本当にデータが無いのか、
 * 取りに行っていないだけなのか」をユーザーが判別できるようにする。 */
function DataCoverageLegend({ coverage }: { coverage: StoredDataCoverage }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(DATA_COVERAGE_LABEL) as (keyof StoredDataCoverage)[]).map((key) => {
        const connected = coverage[key] > 0;
        return (
          <span
            key={key}
            className={`flex items-center gap-1.5 rounded-button border px-2 py-1 text-[11px] font-semibold ${
              connected ? `${TONE.positive.border} ${TONE.positive.bg} ${TONE.positive.text}` : "border-border bg-surface-subtle text-text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? TONE.positive.dot : TONE.muted.dot}`} aria-hidden />
            {DATA_COVERAGE_LABEL[key]}
            {!connected ? "（未接続）" : null}
          </span>
        );
      })}
    </div>
  );
}

/** 決算・財務タブに2期分以上ある指標を折れ線的な棒グラフで示す、実データに基づく推移チャート。
 * 該当する指標が無ければ何も描画しない（データが少ない銘柄では自然に非表示になる）。 */
function MetricTrendChart({ metricKey, periodType, points }: { metricKey: string; periodType: "FY" | "Q"; points: TrendPoint[] }) {
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const label = METRIC_KEY_LABEL[metricKey as keyof typeof METRIC_KEY_LABEL] ?? metricKey;
  return (
    <div className="rounded-card border border-border p-3">
      <p className="text-xs font-semibold text-text-muted">
        {label}の推移 <span className="font-normal text-text-muted">（{periodType === "FY" ? "通期" : "四半期"}・登録済み実データ）</span>
      </p>
      <div className="mt-3 flex items-end gap-3" style={{ height: 96 }}>
        {points.map((p, i) => {
          const heightPct = Math.max(4, (Math.abs(p.value) / max) * 100);
          const isLatest = i === points.length - 1;
          return (
            <div key={p.periodEnd} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-bold tabular-nums text-text-primary">{p.value.toLocaleString()}</span>
              <div
                className={`w-full rounded-t ${isLatest ? "bg-primary" : "bg-primary-soft"}`}
                style={{ height: `${heightPct}%`, transition: "height 0.6s ease" }}
              />
              <span className="text-[10px] text-text-muted">{p.periodEnd}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalysisResultView({ run }: { run: AnalysisRunRow }) {
  const result = run.result_json as unknown as InvestmentAnalysisResult | null;
  if (!result) {
    return (
      <p className="text-sm text-text-secondary">
        前回の分析は完了しませんでした（ステータス: {run.status}）。もう一度実行してください。
      </p>
    );
  }

  const { quantScore, dataCoverage, financials } = readInputSnapshot(run);
  const trend = findTrendMetric(financials);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>最終分析: {formatDateTime(run.created_at)}</span>
        <span>モデル: {run.model}</span>
      </div>

      {dataCoverage ? <DataCoverageLegend coverage={dataCoverage} /> : null}

      <div
        className="rounded-card border border-border p-4"
        style={{
          background:
            "linear-gradient(135deg, var(--primary-soft) 0%, var(--surface) 55%, color-mix(in srgb, var(--series-cyan) 14%, var(--surface)) 100%)",
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">エグゼクティブサマリー</p>
        <p className="mt-2 text-sm leading-6 text-text-primary">{result.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScoreTile label="定量スコア" score={run.quant_score} max={QUANT_SCORE_MAX} />
        <ScoreTile label="中期（1〜3年）" score={result.mediumTerm.score} rating={result.mediumTerm.rating} />
        <ScoreTile label="長期（3〜5年+）" score={result.longTerm.score} rating={result.longTerm.rating} />
        <ScoreTile label="分析の確信度" score={result.confidence} />
      </div>
      <p className="text-[11px] text-text-muted">
        定量スコアはコードによる自動算出（財務指標のみ・判断を含まない）、中期・長期・確信度はAIによる総合判断です。両者は異なる軸のため、数値が一致するとは限りません。
      </p>

      {quantScore ? <QuantScoreBreakdown quantScore={quantScore} /> : null}
      {trend ? <MetricTrendChart metricKey={trend.metricKey} periodType={trend.periodType} points={trend.points} /> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoCard label="中期（1〜3年）判断材料" accent="var(--primary)">
          {result.mediumTerm.thesis}
        </InfoCard>
        <InfoCard label="長期（3〜5年以上）判断材料" accent="var(--series-cyan)">
          {result.longTerm.thesis}
        </InfoCard>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-text-muted">シナリオ</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CaseCard label="強気シナリオ" thesis={result.bullCase.thesis} triggers={result.bullCase.triggers} tone="positive" glyph="▲" />
          <CaseCard label="中立シナリオ" thesis={result.baseCase.thesis} triggers={result.baseCase.triggers} tone="info" glyph="■" />
          <CaseCard label="弱気シナリオ" thesis={result.bearCase.thesis} triggers={result.bearCase.triggers} tone="negative" glyph="▼" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`rounded-card border p-3 ${TONE.positive.border} ${TONE.positive.bg}`}>
          <p className={`text-xs font-semibold ${TONE.positive.text}`}>強み</p>
          <BulletList items={result.strengths} tone="positive" emptyLabel="データなし" />
        </div>
        <div className={`rounded-card border p-3 ${TONE.negative.border} ${TONE.negative.bg}`}>
          <p className={`text-xs font-semibold ${TONE.negative.text}`}>懸念点</p>
          <BulletList items={result.weaknesses} tone="negative" emptyLabel="データなし" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoCard label="経営陣の評価" accent="var(--primary)">
          {result.managementAssessment}
        </InfoCard>
        <InfoCard label="財務の評価" accent="var(--series-mint)">
          {result.financialAssessment}
        </InfoCard>
        <InfoCard label="バリュエーションの評価" accent="var(--series-cyan)">
          {result.valuationAssessment}
        </InfoCard>
        <InfoCard label="競争力の評価" accent="var(--series-yellow)">
          {result.competitiveAssessment}
        </InfoCard>
      </div>

      {result.dataGaps.length > 0 ? (
        <div className={`rounded-card border p-3 ${TONE.neutral.border} ${TONE.neutral.bg}`}>
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${TONE.neutral.text}`}>
            <span aria-hidden>⚠</span>
            データ不足の項目
          </p>
          <ul className="mt-1 space-y-1 text-sm text-text-secondary">
            {result.dataGaps.map((g, i) => (
              <li key={i} className="flex gap-1.5">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE.neutral.dot}`} aria-hidden />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AiAnalysisPanel({
  providerSymbol,
  latestRun,
}: {
  providerSymbol: string;
  latestRun: AnalysisRunRow | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => runAnalysis(providerSymbol),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <AnalyticsPanel
      title="AI分析（長期保有判断材料）"
      action={
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-button bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {mutation.isPending ? "分析中..." : latestRun ? "AI分析を更新" : "AI分析を実行"}
        </button>
      }
    >
      <p className="mb-3 text-xs text-text-muted">
        本分析は登録済みのデータに基づくリサーチ支援指標であり、将来の株価上昇や投資成果を保証するものではありません。
      </p>

      {mutation.isPending ? (
        <div className="flex flex-col gap-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-subtle" />
          <div className="h-20 animate-pulse rounded bg-surface-subtle" />
          <div className="h-20 animate-pulse rounded bg-surface-subtle" />
        </div>
      ) : error ? (
        <div className="rounded-button border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm text-danger">分析に失敗しました: {error}</p>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            className="mt-2 rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
          >
            再試行
          </button>
        </div>
      ) : latestRun ? (
        <AnalysisResultView run={latestRun} />
      ) : (
        <p className="text-sm text-text-secondary">
          まだAI分析が実行されていません。「決算・財務」「リサーチ」タブでデータを登録してから「AI分析を実行」を押してください。データが少ないほど分析結果の確信度は低くなります。
        </p>
      )}
    </AnalyticsPanel>
  );
}
