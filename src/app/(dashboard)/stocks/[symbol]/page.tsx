import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MOCK_INSTRUMENT_CATALOG } from "@/lib/mock/instrument-catalog";
import { buildMockFavoriteStock } from "@/lib/mock/favorite-stocks";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { PriceChart } from "@/components/charts/PriceChart";
import { PercentChange } from "@/components/tables/PercentChange";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { formatDate, formatPercent } from "@/lib/utils/format";
import { generateMockDailySeries } from "@/lib/mock/series";

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const providerSymbol = decodeURIComponent(params.symbol);
  const instrument = MOCK_INSTRUMENT_CATALOG[providerSymbol];

  if (!instrument) {
    notFound();
  }

  const favoriteStock = buildMockFavoriteStock(instrument, new Date().toISOString());
  const dailyPrices = generateMockDailySeries(instrument.providerSymbol, 260 * 10, favoriteStock.quote.close ?? 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={instrument.market === "JP" ? "/japan" : "/us"}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          戻る
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary md:text-[30px]">{instrument.name}</h1>
            <p className="text-sm text-text-secondary">
              {instrument.displaySymbol} · {instrument.exchange} · {instrument.currency}
            </p>
          </div>
          <FavoriteToggle instrument={instrument} />
        </div>
        <p className="text-xs text-text-muted">価格基準日 {formatDate(favoriteStock.quote.priceDate)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="最新終値">
          <MetricValue>
            <CurrencyValue value={favoriteStock.quote.close} currency={instrument.currency} />
          </MetricValue>
        </MetricCard>
        <MetricCard label="前営業日比">
          <MetricValue>
            <PercentChange amount={favoriteStock.quote.change} percent={favoriteStock.quote.changePercent} />
          </MetricValue>
        </MetricCard>
        <MetricCard label="1年騰落率">
          <MetricValue>{formatPercent(favoriteStock.return1y)}</MetricValue>
        </MetricCard>
        <MetricCard label="配当利回り（予想）">
          <MetricValue>
            {favoriteStock.quote.dividendYield !== null ? `${favoriteStock.quote.dividendYield.toFixed(2)}%` : "—"}
          </MetricValue>
        </MetricCard>
      </div>

      <PriceChart dailyPrices={dailyPrices} title={instrument.name} />

      <div className="rounded-card border border-border bg-surface p-5">
        <p className="mb-3 text-lg font-bold text-text-primary">指標</p>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-text-muted">配当利回り</dt>
            <dd className="font-semibold text-text-primary">
              {favoriteStock.quote.dividendYield !== null ? `${favoriteStock.quote.dividendYield.toFixed(2)}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">通貨</dt>
            <dd className="font-semibold text-text-primary">{instrument.currency}</dd>
          </div>
          <div>
            <dt className="text-text-muted">取引所</dt>
            <dd className="font-semibold text-text-primary">{instrument.exchange ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
