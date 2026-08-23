"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { formatDateTime } from "@/lib/utils/format";
import type { InvestmentAnalysisResult } from "@/lib/ai/investment-analysis/response";

type AnalysisRunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

// src/lib/scoring/quant-score.ts: maxTotal is always 70 (fixed sum of the 6 sub-category maxes),
// but analysis_runs only persists the total, not the breakdown -- so the max is hardcoded here to
// match that invariant rather than recomputed from data we don't have at display time.
const QUANT_SCORE_MAX = 70;

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

function AnalysisResultView({ run }: { run: AnalysisRunRow }) {
  const result = run.result_json as unknown as InvestmentAnalysisResult | null;
  if (!result) {
    return (
      <p className="text-sm text-text-secondary">
        前回の分析は完了しませんでした（ステータス: {run.status}）。もう一度実行してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>最終分析: {formatDateTime(run.created_at)}</span>
        <span>モデル: {run.model}</span>
      </div>

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
