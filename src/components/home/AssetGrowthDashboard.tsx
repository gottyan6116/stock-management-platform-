/* Hallmark · genre: modern-minimal · macrostructure: Workbench · tone: technical · anchor hue: blue
 * pre-emit critique: P5 H5 E4 S5 R5 V4 · contrast: pass · honest-data: pass
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Briefcase, History } from "lucide-react";
import { PortfolioCompositionDonut } from "@/components/charts/PortfolioCompositionDonut";
import { EvidenceCoveragePanel } from "@/components/research/EvidenceCoveragePanel";
import { GlobalStockSearch } from "@/components/search/GlobalStockSearch";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { Skeleton } from "@/components/feedback/Skeleton";
import {
  HoldingsOutlookTable,
  type DashboardHorizon,
} from "@/components/home/HoldingsOutlookTable";
import { PortfolioStatusStrip } from "@/components/home/PortfolioStatusStrip";
import { isSampleResearchEnabled } from "@/config/research";
import { fetchPositions, POSITIONS_KEY } from "@/features/portfolio/api";
import {
  evaluatePositions,
  getPortfolioProfitState,
  summarizeByCurrency,
} from "@/features/portfolio/summary";
import {
  calculateEvidenceCompleteness,
  getResearchOutlook,
  summarizePortfolioSampleOutlook,
} from "@/features/research/sample-outlooks";
import type {
  EvidenceCategory,
  EvidenceStatus,
  ResearchEvidence,
  ResearchOutlook,
} from "@/features/research/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

const horizons: { value: DashboardHorizon; label: string }[] = [
  { value: "1y", label: "1年" },
  { value: "3y", label: "3年" },
  { value: "5y", label: "5年" },
];

const evidenceCategories: EvidenceCategory[] = [
  "prices",
  "financials",
  "competitors",
  "orderBook",
  "statements",
  "events",
];

function aggregatePortfolioEvidence(outlooks: readonly ResearchOutlook[]): ResearchEvidence[] {
  if (outlooks.length === 0) return [];

  return evidenceCategories.map((category) => {
    const matching = outlooks.map((outlook) =>
      outlook.evidence.find((item) => item.category === category)
    );
    const currentCount = matching.filter((item) => item?.status === "current").length;
    const hasStale = matching.some((item) => item?.status === "stale");
    const status: EvidenceStatus =
      currentCount === outlooks.length
        ? "current"
        : hasStale || currentCount > 0
          ? "stale"
          : "missing";
    return {
      category,
      status,
      detail: `${currentCount}/${outlooks.length}銘柄で更新済み`,
    };
  });
}

function summarizeSampleProvenance(outlooks: readonly ResearchOutlook[]): string | null {
  if (outlooks.length === 0) return null;

  const sources = [...new Set(outlooks.map((outlook) => outlook.source))];
  const modelVersions = [...new Set(outlooks.map((outlook) => outlook.modelVersion))];
  const updatedAtValues = outlooks
    .map((outlook) => outlook.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestUpdatedAt = updatedAtValues.at(-1);
  const updateCopy =
    updatedAtValues.length === 0
      ? "更新時刻なし"
      : updatedAtValues.length < outlooks.length
        ? `更新時刻 一部なし（最新 ${formatDateTime(latestUpdatedAt ?? null)}）`
        : `更新 ${formatDateTime(latestUpdatedAt ?? null)}`;

  return `サンプル · ${sources.join(" / ")} · ${modelVersions.join(" / ")} · ${updateCopy}`;
}

function AssetGrowthDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="資産成長レポートを読み込み中">
      <Skeleton className="h-32 w-full rounded-card" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Skeleton className="h-[330px] w-full rounded-card" />
        <Skeleton className="h-[330px] w-full rounded-card" />
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}

function AssetGrowthDashboardHeader({
  fetchedAtLabel,
  horizon,
  onHorizonChange,
  showHorizonControls,
}: {
  fetchedAtLabel: string;
  horizon: DashboardHorizon;
  onHorizonChange: (horizon: DashboardHorizon) => void;
  showHorizonControls: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold text-text-secondary">長期で含み益を育てる</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
          資産成長レポート
        </h1>
        <p className="mt-1 text-xs text-text-muted">最終取得 {fetchedAtLabel}</p>
      </div>

      <div
        className={cn(
          "grid w-full gap-3 lg:max-w-3xl lg:items-end",
          showHorizonControls && "lg:grid-cols-[minmax(260px,1fr)_auto]"
        )}
      >
        <GlobalStockSearch />
        {showHorizonControls ? (
          <div
            role="group"
            aria-label="見通し期間"
            className="inline-grid w-full grid-cols-3 overflow-hidden rounded-button border border-border bg-surface-subtle sm:w-auto"
          >
            {horizons.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={horizon === item.value}
                onClick={() => onHorizonChange(item.value)}
                className={cn(
                  "min-h-11 min-w-20 whitespace-nowrap border-l border-border px-4 text-sm font-bold first:border-l-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                  horizon === item.value
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function DashboardLoadError() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-card border border-danger bg-danger-soft px-6 text-center">
      <AlertTriangle className="h-7 w-7 text-danger" aria-hidden />
      <h1 className="text-lg font-bold text-text-primary">資産情報を読み込めませんでした</h1>
      <p className="max-w-md text-sm text-text-secondary">
        通信状態を確認してから再読み込みしてください。登録済みデータは変更されていません。
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 whitespace-nowrap rounded-button bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        再読み込み
      </button>
    </div>
  );
}

function EmptyPortfolioHome() {
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center border-y border-border bg-surface px-6 text-center">
      <Briefcase className="h-9 w-9 text-primary" aria-hidden />
      <h1 className="mt-4 text-xl font-bold text-text-primary">資産成長レポートを始めましょう</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
        保有資産を登録すると、通貨別の評価額と含み損益を実データから確認できます。
      </p>
      <Link
        href="/portfolio"
        className="mt-5 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-button bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:bg-primary-hover"
      >
        保有資産を登録する
      </Link>
    </section>
  );
}

export function AssetGrowthDashboard() {
  const [horizon, setHorizon] = useState<DashboardHorizon>("1y");
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: fetchPositions,
  });
  const evaluated = useMemo(() => evaluatePositions(data), [data]);
  const summaries = useMemo(() => summarizeByCurrency(evaluated), [evaluated]);
  const profitState = useMemo(() => getPortfolioProfitState(summaries), [summaries]);
  const sampleEnabled = isSampleResearchEnabled();

  const sampleOutlooks = useMemo(
    () =>
      sampleEnabled ? evaluated.map((position) => getResearchOutlook(position.providerSymbol)) : [],
    [evaluated, sampleEnabled]
  );
  const portfolioEvidence = useMemo(
    () => aggregatePortfolioEvidence(sampleOutlooks),
    [sampleOutlooks]
  );
  const reviewCount = useMemo(() => {
    if (!sampleEnabled || horizon === "5y") return null;
    return sampleOutlooks.filter((outlook) => outlook.horizonScores[horizon].action === "review")
      .length;
  }, [horizon, sampleEnabled, sampleOutlooks]);
  const evidenceCompleteness = sampleEnabled
    ? calculateEvidenceCompleteness(portfolioEvidence)
    : null;
  const portfolioOutlook = useMemo(
    () =>
      sampleEnabled && horizon !== "5y"
        ? summarizePortfolioSampleOutlook(sampleOutlooks, horizon)
        : null,
    [horizon, sampleEnabled, sampleOutlooks]
  );
  const portfolioOutlookProvenance = useMemo(
    () => (portfolioOutlook ? summarizeSampleProvenance(sampleOutlooks) : null),
    [portfolioOutlook, sampleOutlooks]
  );
  const latestFetchedAt = evaluated
    .map((position) => position.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const fetchedAtLabel = isLoading
    ? "読み込み中"
    : isError
      ? "取得失敗"
      : latestFetchedAt
        ? formatDateTime(latestFetchedAt)
        : "未取得";
  const showPortfolioReport = !isLoading && !isError && evaluated.length > 0;
  const stockCount = evaluated.filter((position) => position.instrumentType === "stock").length;
  const fundCount = evaluated.filter((position) => position.instrumentType === "fund").length;
  const otherCount = evaluated.length - stockCount - fundCount;

  return (
    <div className="flex flex-col gap-5">
      <AssetGrowthDashboardHeader
        fetchedAtLabel={fetchedAtLabel}
        horizon={horizon}
        onHorizonChange={setHorizon}
        showHorizonControls={showPortfolioReport}
      />

      {isLoading ? <AssetGrowthDashboardSkeleton /> : null}
      {isError ? <DashboardLoadError /> : null}
      {!isLoading && !isError && evaluated.length === 0 ? <EmptyPortfolioHome /> : null}

      {showPortfolioReport ? (
        <>
          <PortfolioStatusStrip
            summaries={summaries}
            profitState={profitState}
            reviewCount={reviewCount}
            evidenceCompleteness={evidenceCompleteness}
            sampleEnabled={sampleEnabled}
            portfolioOutlook={portfolioOutlook}
            portfolioOutlookProvenance={portfolioOutlookProvenance}
          />

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <AnalyticsPanel title="資産価値と含み益の推移" className="min-w-0">
              <div className="flex h-[220px] flex-col items-center justify-center bg-surface-subtle px-6 text-center md:h-[280px]">
                <History className="h-7 w-7 text-text-muted" aria-hidden />
                <p className="mt-3 text-sm font-bold text-text-primary">
                  履歴データがまだありません
                </p>
                <p className="mt-1 max-w-md text-xs leading-5 text-text-secondary">
                  日次のポートフォリオ履歴を接続後、JPY /
                  USDを分けて評価額と含み損益の推移を表示します。
                </p>
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel title="保有内訳（銘柄数ベース）">
              <div className="flex min-h-[220px] items-center justify-center md:min-h-[280px]">
                <PortfolioCompositionDonut
                  stockCount={stockCount}
                  fundCount={fundCount}
                  otherCount={otherCount}
                />
              </div>
            </AnalyticsPanel>
          </div>

          <HoldingsOutlookTable
            positions={evaluated}
            sampleEnabled={sampleEnabled}
            horizon={horizon}
          />

          <EvidenceCoveragePanel
            dataKind={sampleEnabled ? "sample" : "unavailable"}
            evidence={sampleEnabled ? portfolioEvidence : []}
          />
        </>
      ) : null}
    </div>
  );
}
