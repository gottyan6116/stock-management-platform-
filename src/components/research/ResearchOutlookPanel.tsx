import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { SegmentedMetric, SegmentedMetricStrip } from "@/components/ui/SegmentedMetricStrip";
import type { HorizonScore, ResearchOutlook } from "@/features/research/types";
import { formatDateTime } from "@/lib/utils/format";

const downsideRiskLabels: Record<HorizonScore["downsideRisk"], string> = {
  low: "低い",
  medium: "中程度",
  high: "高い",
};

function FactorList({ title, factors }: { title: string; factors: readonly string[] }) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      {factors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-text-secondary">
          {factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">確認できる材料はまだありません。</p>
      )}
    </section>
  );
}

function formatExpectedRange(score: HorizonScore): string {
  const range = score.expectedReturnRange;
  if (!range) return "未算出";
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
  return `${signed(range.minPercent)}〜${signed(range.maxPercent)}`;
}

function OutlookMetrics({ label, score }: { label: string; score: HorizonScore }) {
  return (
    <section aria-labelledby={`outlook-${score.horizon}`}>
      <h3 id={`outlook-${score.horizon}`} className="mb-2 text-sm font-bold text-text-primary">
        {label}
      </h3>
      <SegmentedMetricStrip ariaLabel={`${label}の見通し`}>
        <SegmentedMetric label="プラスの可能性" value={`${score.positiveProbability}%`} />
        <SegmentedMetric
          label="比較指数を上回る可能性"
          value={
            score.benchmarkOutperformanceProbability === null
              ? "未算出"
              : `${score.benchmarkOutperformanceProbability}%`
          }
        />
        <SegmentedMetric label="想定リターン範囲" value={formatExpectedRange(score)} />
        <SegmentedMetric label="下落リスク" value={downsideRiskLabels[score.downsideRisk]} />
        <SegmentedMetric label="根拠の強さ" value={`${score.evidenceStrength}%`} />
      </SegmentedMetricStrip>
    </section>
  );
}

export function ResearchOutlookPanel({ outlook }: { outlook: ResearchOutlook | null }) {
  if (!outlook) {
    return (
      <AnalyticsPanel title="見通し">
        <p className="text-sm font-semibold text-text-primary">実データはまだ接続されていません</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          実データに基づく見通しを準備中です。現在は評価値や材料を表示していません。
        </p>
      </AnalyticsPanel>
    );
  }

  const provenance = `${outlook.sampleLabel} · ${outlook.source} · ${outlook.modelVersion} · ${
    outlook.updatedAt ? `更新 ${formatDateTime(outlook.updatedAt)}` : "更新時刻なし"
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm leading-6 text-text-secondary">
            画面確認用の例です。実際の投資判断には利用できません。
          </p>
          <p className="mt-1 text-xs text-text-muted">{provenance}</p>
        </div>
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-text">
          {outlook.sampleLabel}
        </span>
      </div>

      <div className="grid gap-5">
        <OutlookMetrics label="1年の見通し" score={outlook.horizonScores["1y"]} />
        <OutlookMetrics label="3年の見通し" score={outlook.horizonScores["3y"]} />
      </div>

      <AnalyticsPanel title="材料と未確認点">
        <div className="space-y-4">
          <FactorList title="期待できる材料" factors={outlook.positiveFactors} />
          <FactorList title="注意すべき材料" factors={outlook.cautionFactors} />
          <FactorList title="まだ確認できていない点" factors={outlook.unknowns} />
        </div>
      </AnalyticsPanel>
    </div>
  );
}
