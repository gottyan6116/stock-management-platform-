"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import { useFavorites } from "@/features/favorites/FavoritesProvider";
import { buildMockFavoriteStock, buildMockDailySeriesFor } from "@/lib/mock/favorite-stocks";
import { computeFavoriteBasketIndex } from "@/lib/aggregation/basket-index";
import { MetricCard, MetricDelta, MetricValue } from "@/components/ui/MetricCard";
import { MarketRatioDonut } from "@/components/charts/MarketRatioDonut";
import { BasketIndexChart } from "@/components/charts/BasketIndexChart";
import { StockTable } from "@/components/tables/StockTable";
import { EmptyState } from "@/components/feedback/EmptyState";
import { CardSkeleton, TableSkeleton } from "@/components/feedback/Skeleton";
import { formatPercent } from "@/lib/utils/format";

const FAVORITED_AT_FALLBACK = new Date().toISOString();

export function FavoritesDashboard() {
  const { favoriteInstruments, isLoading } = useFavorites();

  const favoriteStocks = useMemo(
    () => favoriteInstruments.map((instrument) => buildMockFavoriteStock(instrument, FAVORITED_AT_FALLBACK)),
    [favoriteInstruments]
  );

  const jpCount = favoriteStocks.filter((s) => s.instrument.market === "JP").length;
  const usCount = favoriteStocks.filter((s) => s.instrument.market === "US").length;

  const returns1y = favoriteStocks.map((s) => s.return1y).filter((v): v is number => v !== null);
  const avgReturn1y = returns1y.length > 0 ? returns1y.reduce((a, b) => a + b, 0) / returns1y.length : null;

  const dividendYields = favoriteStocks
    .map((s) => s.quote.dividendYield)
    .filter((v): v is number => v !== null);
  const avgDividendYield =
    dividendYields.length > 0 ? dividendYields.reduce((a, b) => a + b, 0) / dividendYields.length : null;

  const basketPoints = useMemo(() => {
    const seriesList = favoriteInstruments.map((i) => buildMockDailySeriesFor(i, 260 * 3));
    return computeFavoriteBasketIndex(seriesList);
  }, [favoriteInstruments]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (favoriteStocks.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="まだお気に入り銘柄がありません"
        description="銘柄名・コード・ティッカーで検索して追加してください"
        action={
          <button
            type="button"
            onClick={() => document.getElementById("global-stock-search-input")?.focus()}
            className="rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            銘柄を検索
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="お気に入り銘柄">
          <MetricValue>{favoriteStocks.length}銘柄</MetricValue>
          <MetricDelta>
            日本 {jpCount} / 米国 {usCount}
          </MetricDelta>
        </MetricCard>
        <MetricCard
          label="1年騰落率（単純平均）"
          tooltip={`調整後終値ベース。1年前データがある${returns1y.length}銘柄が対象`}
        >
          <MetricValue>{formatPercent(avgReturn1y)}</MetricValue>
          <MetricDelta>{returns1y.length}銘柄が対象</MetricDelta>
        </MetricCard>
        <MetricCard label="日本株 / 米国株 比率">
          <MetricValue>
            {favoriteStocks.length > 0 ? Math.round((jpCount / favoriteStocks.length) * 100) : 0}% /{" "}
            {favoriteStocks.length > 0 ? Math.round((usCount / favoriteStocks.length) * 100) : 0}%
          </MetricValue>
          <MetricDelta>銘柄数ベース</MetricDelta>
        </MetricCard>
        <MetricCard label="平均配当利回り（予想）" tooltip={`取得可能な${dividendYields.length}銘柄が対象`}>
          <MetricValue>
            {avgDividendYield !== null ? `${avgDividendYield.toFixed(2)}%` : "—"}
          </MetricValue>
          <MetricDelta>{dividendYields.length}銘柄が対象</MetricDelta>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BasketIndexChart points={basketPoints} />
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-3 text-lg font-bold text-text-primary">日本株 / 米国株比率</p>
          <MarketRatioDonut jpCount={jpCount} usCount={usCount} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-lg font-bold text-text-primary">お気に入り一覧</p>
        <StockTable stocks={favoriteStocks} showMarketFilter defaultSort="favoritedAt" />
      </div>
    </div>
  );
}
