"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { formatDateTime } from "@/lib/utils/format";
import type { InvestmentAnalysisResult } from "@/lib/ai/investment-analysis/response";

type AnalysisRunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

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

function ScoreTile({ label, score, rating }: { label: string; score: number | null; rating?: string | null }) {
  return (
    <div className="rounded-button border border-border p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{score !== null ? Math.round(score) : "—"}</p>
      {rating ? <p className="mt-0.5 text-xs text-text-secondary">{rating}</p> : null}
    </div>
  );
}

function CaseCard({ label, thesis, triggers }: { label: string; thesis: string; triggers: string[] }) {
  return (
    <div className="rounded-button border border-border p-3">
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{thesis}</p>
      {triggers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-text-secondary">
          {triggers.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : null}
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>最終分析: {formatDateTime(run.created_at)}</span>
        <span>モデル: {run.model}</span>
      </div>

      <p className="text-sm leading-6 text-text-primary">{result.executiveSummary}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScoreTile label="定量スコア" score={run.quant_score} />
        <ScoreTile label="中期（1〜3年）" score={result.mediumTerm.score} rating={result.mediumTerm.rating} />
        <ScoreTile label="長期（3〜5年+）" score={result.longTerm.score} rating={result.longTerm.rating} />
        <ScoreTile label="分析の確信度" score={result.confidence} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">中期（1〜3年）判断材料</p>
          <p className="mt-1 text-sm text-text-primary">{result.mediumTerm.thesis}</p>
        </div>
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">長期（3〜5年以上）判断材料</p>
          <p className="mt-1 text-sm text-text-primary">{result.longTerm.thesis}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-text-muted">シナリオ</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CaseCard label="強気シナリオ" thesis={result.bullCase.thesis} triggers={result.bullCase.triggers} />
          <CaseCard label="中立シナリオ" thesis={result.baseCase.thesis} triggers={result.baseCase.triggers} />
          <CaseCard label="弱気シナリオ" thesis={result.bearCase.thesis} triggers={result.bearCase.triggers} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">強み</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-text-primary">
            {result.strengths.length > 0 ? result.strengths.map((s, i) => <li key={i}>{s}</li>) : <li className="text-text-muted">データなし</li>}
          </ul>
        </div>
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">懸念点</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-text-primary">
            {result.weaknesses.length > 0 ? result.weaknesses.map((s, i) => <li key={i}>{s}</li>) : <li className="text-text-muted">データなし</li>}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">経営陣の評価</p>
          <p className="mt-1 text-sm text-text-primary">{result.managementAssessment}</p>
        </div>
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">財務の評価</p>
          <p className="mt-1 text-sm text-text-primary">{result.financialAssessment}</p>
        </div>
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">バリュエーションの評価</p>
          <p className="mt-1 text-sm text-text-primary">{result.valuationAssessment}</p>
        </div>
        <div className="rounded-button border border-border p-3">
          <p className="text-xs font-semibold text-text-muted">競争力の評価</p>
          <p className="mt-1 text-sm text-text-primary">{result.competitiveAssessment}</p>
        </div>
      </div>

      {result.dataGaps.length > 0 ? (
        <div className="rounded-button border border-warning/40 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning">データ不足の項目</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-text-secondary">
            {result.dataGaps.map((g, i) => (
              <li key={i}>{g}</li>
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
