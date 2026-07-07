"use client";

import { useMemo } from "react";
import type { Market } from "@/types/domain";
import type { WatchlistEntry } from "@/config/watchlist";
import { MOCK_INSTRUMENT_CATALOG } from "@/lib/mock/instrument-catalog";
import { buildMockFavoriteStock, buildMockDailySeriesFor } from "@/lib/mock/favorite-stocks";
import { useFavorites } from "@/features/favorites/FavoritesProvider";
import { MetricCard, MetricDelta, MetricValue } from "@/components/ui/MetricCard";
import { PriceChart } from "@/components/charts/PriceChart";
import { StockTable } from "@/components/tables/StockTable";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { PercentChange } from "@/components/tables/PercentChange";
import { formatDate, formatDateTime, formatPercent } from "@/lib/utils/format";
import type { Instrument, Quote } from "@/types/domain";
import { TableSkeleton } from "@/components/feedback/Skeleton";

interface MarketIndexInfo {
  name: string;
  quote: Quote;
  dailyPrices: ReturnType<typeof buildMockDailySeriesFor>;
}

export function MarketPageDashboard({
  market,
  marketLabel,
  index,
  overviewRows,
  featuredSymbols,
}: {
  market: Market;
  marketLabel: string;
  index: MarketIndexInfo;
  overviewRows: { label: string; value: string }[];
  featuredSymbols: WatchlistEntry[];
}) {
  const { favoriteInstruments, isLoading } = useFavorites();

  const marketFavoriteInstruments = useMemo(
    () => favoriteInstruments.filter((i) => i.market === market),
    [favoriteInstruments, market]
  );

  const favoriteStocks = useMemo(
    () => marketFavoriteInstruments.map((i) => buildMockFavoriteStock(i, new Date().toISOString())),
    [marketFavoriteInstruments]
  );

  const featuredOnlyInstruments = useMemo(() => {
    const favoritedSymbols = new Set(marketFavoriteInstruments.map((i) => i.providerSymbol));
    return featuredSymbols
      .map((entry) => MOCK_INSTRUMENT_CATALOG[entry.providerSymbol])
      .filter((instrument): instrument is Instrument => Boolean(instrument))
      .filter((instrument) => !favoritedSymbols.has(instrument.providerSymbol));
  }, [featuredSymbols, marketFavoriteInstruments]);

  const featuredStocks = useMemo(
    () => featuredOnlyInstruments.map((i) => buildMockFavoriteStock(i, new Date().toISOString())),
    [featuredOnlyInstruments]
  );

  const returns1y = favoriteStocks.map((s) => s.return1y).filter((v): v is number => v !== null);
  const avgReturn1y = returns1y.length > 0 ? returns1y.reduce((a, b) => a + b, 0) / returns1y.length : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:gap-4">
        <MetricCard label={`${index.name} 最新終値`}>
          <MetricValue>
            <CurrencyValue value={index.quote.close} currency={market === "JP" ? "JPY" : "USD"} />
          </MetricValue>
          <MetricDelta>基準日 {formatDate(index.quote.priceDate)}</MetricDelta>
        </MetricCard>
        <MetricCard label={`${index.name} 前営業日比`}>
          <MetricValue>
            <PercentChange amount={index.quote.change} percent={index.quote.changePercent} />
          </MetricValue>
        </MetricCard>
        <MetricCard label={`${marketLabel}お気に入り数`}>
          <MetricValue>{isLoading ? "—" : `${favoriteStocks.length}銘柄`}</MetricValue>
        </MetricCard>
        <MetricCard label={`${marketLabel}お気に入り 1年騰落率平均`} tooltip={`対象${returns1y.length}銘柄`}>
          <MetricValue>{isLoading ? "—" : formatPercent(avgReturn1y)}</MetricValue>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PriceChart dailyPrices={index.dailyPrices} title={index.name} />
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-3 text-lg font-bold text-text-primary">{marketLabel}市場概要</p>
          <dl className="flex flex-col gap-2 text-sm">
            {overviewRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <dt className="text-text-secondary">{row.label}</dt>
                <dd className="tabular-nums font-semibold text-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-text-muted">
            価格基準日 {formatDate(index.quote.priceDate)} ・ 取得 {formatDateTime(index.quote.fetchedAt)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          {favoriteStocks.length > 0 ? (
            <div>
              <p className="mb-3 text-lg font-bold text-text-primary">{marketLabel}のお気に入り</p>
              <StockTable stocks={favoriteStocks} />
            </div>
          ) : null}

          {featuredStocks.length > 0 ? (
            <div>
              <p className="mb-3 text-lg font-bold text-text-primary">{marketLabel}の注目銘柄</p>
              <StockTable stocks={featuredStocks} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
