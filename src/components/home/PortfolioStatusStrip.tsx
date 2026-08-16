import { SegmentedMetric, SegmentedMetricStrip } from "@/components/ui/SegmentedMetricStrip";
import type { PortfolioCurrencySummary, PortfolioProfitState } from "@/features/portfolio/types";
import type { PortfolioSampleOutlookSummary } from "@/features/research/sample-outlooks";
import { formatCurrency } from "@/lib/utils/format";

const profitStateCopy: Record<
  PortfolioProfitState,
  { summary: string; short: string; tone: "positive" | "negative" | "warning" | "neutral" }
> = {
  positive: { summary: "資産全体はプラス", short: "プラス", tone: "positive" },
  negative: { summary: "資産全体はマイナス", short: "マイナス", tone: "negative" },
  flat: { summary: "資産全体は取得額と同水準", short: "同水準", tone: "neutral" },
  mixed: {
    summary: "通貨別で損益が分かれています",
    short: "通貨別",
    tone: "warning",
  },
  partial: {
    summary: "一部未計算のため資産全体の損益は判定できません",
    short: "一部未計算",
    tone: "warning",
  },
  unknown: { summary: "損益を計算できません", short: "未計算", tone: "neutral" },
};

function signedCurrency(value: number, currency: PortfolioCurrencySummary["currency"]) {
  return `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

export function PortfolioStatusStrip({
  summaries,
  profitState,
  reviewCount,
  evidenceCompleteness,
  sampleEnabled,
  portfolioOutlook,
  portfolioOutlookProvenance,
}: {
  summaries: PortfolioCurrencySummary[];
  profitState: PortfolioProfitState;
  reviewCount: number | null;
  evidenceCompleteness: number | null;
  sampleEnabled: boolean;
  portfolioOutlook: PortfolioSampleOutlookSummary | null;
  portfolioOutlookProvenance: string | null;
}) {
  const sortedSummaries = [...summaries].sort((a, b) => a.currency.localeCompare(b.currency));
  const state = profitStateCopy[profitState];
  const outlookUnavailable = sampleEnabled ? "未提供" : "未接続";
  const downsideRisk = portfolioOutlook
    ? { low: "低い", medium: "中程度", high: "高い" }[portfolioOutlook.downsideRisk]
    : outlookUnavailable;

  return (
    <section aria-labelledby="portfolio-status-heading">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2 id="portfolio-status-heading" className="text-lg font-bold text-text-primary">
            資産全体の現在地
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-text-secondary">{state.summary}</p>
        </div>
        <p className="text-xs text-text-muted">通貨換算は行わず、JPY / USDを分けて表示</p>
      </div>

      <SegmentedMetricStrip ariaLabel="資産全体の現在地">
        {sortedSummaries.flatMap((summary) => [
          <SegmentedMetric
            key={`${summary.currency}-valuation`}
            label={`${summary.currency} 評価額${summary.isValuationComplete ? "" : "（一部未計算）"}`}
            value={
              summary.hasValuation ? formatCurrency(summary.marketValue, summary.currency) : "—"
            }
          />,
          <SegmentedMetric
            key={`${summary.currency}-profit`}
            label={`${summary.currency} 含み損益${summary.isCostBasisComplete ? "" : "（一部未計算）"}`}
            value={
              summary.hasCostBasis ? signedCurrency(summary.unrealizedPnl, summary.currency) : "—"
            }
            tone={
              !summary.hasCostBasis || summary.unrealizedPnl === 0
                ? "neutral"
                : summary.unrealizedPnl > 0
                  ? "positive"
                  : "negative"
            }
          />,
        ])}
        <SegmentedMetric label="損益状態" value={state.short} tone={state.tone} />
        <SegmentedMetric
          label={
            portfolioOutlook
              ? "ポートフォリオのプラス可能性（サンプル）"
              : "ポートフォリオのプラス可能性"
          }
          value={portfolioOutlook ? `${portfolioOutlook.positiveProbability}%` : outlookUnavailable}
        />
        <SegmentedMetric
          label={portfolioOutlook ? "下落リスク（サンプル）" : "下落リスク"}
          value={downsideRisk}
          tone={
            portfolioOutlook?.downsideRisk === "high"
              ? "negative"
              : portfolioOutlook?.downsideRisk === "medium"
                ? "warning"
                : "neutral"
          }
        />
        <SegmentedMetric
          label={sampleEnabled ? "見直し候補（サンプル）" : "見直し候補"}
          value={reviewCount === null ? "—" : `${reviewCount}銘柄`}
          tone={reviewCount && reviewCount > 0 ? "warning" : "neutral"}
        />
        <SegmentedMetric
          label={sampleEnabled ? "根拠の充実度（サンプル）" : "根拠の充実度"}
          value={evidenceCompleteness === null ? "—" : `${evidenceCompleteness}%`}
        />
      </SegmentedMetricStrip>
      {portfolioOutlook ? (
        <div className="mt-2 space-y-1 text-xs leading-5 text-text-muted">
          {portfolioOutlookProvenance ? <p>{portfolioOutlookProvenance}</p> : null}
          <p>
            サンプルのプラス可能性は保有銘柄を同数で平均し、下落リスクは最も高い区分を表示しています。評価額・通貨は合算していません。
          </p>
        </div>
      ) : null}
    </section>
  );
}
