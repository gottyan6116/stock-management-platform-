import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import type { Instrument } from "@/types/domain";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { PriceChart } from "@/components/charts/PriceChart";
import { PercentChange } from "@/components/tables/PercentChange";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { formatDate, formatPercent } from "@/lib/utils/format";

function tenYearsAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function StockDetailPage({ params }: { params: { symbol: string } }) {
  const providerSymbol = normalizeProviderSymbol(decodeURIComponent(params.symbol));
  const provider = getMarketDataProvider();

  const info = await provider.getInstrumentInfo(providerSymbol).catch(() => null);
  if (!info) {
    notFound();
  }

  const instrument: Instrument = {
    id: providerSymbol,
    providerSymbol: info.providerSymbol,
    displaySymbol: info.displaySymbol,
    name: info.name,
    exchange: info.exchange,
    market: info.market,
    currency: info.currency,
    instrumentType: info.instrumentType,
  };

  const [quote, dailyPrices] = await Promise.all([
    provider.getQuote(providerSymbol).catch(() => null),
    provider.getDailyPrices(providerSymbol, tenYearsAgoIso(), todayIso()).catch(() => []),
  ]);

  const lastClose = dailyPrices.at(-1)?.adjustedClose ?? null;
  const oneYearAgoIndex = Math.max(0, dailyPrices.length - 253);
  const oneYearAgoClose = dailyPrices[oneYearAgoIndex]?.adjustedClose ?? null;
  const return1y =
    lastClose !== null && oneYearAgoClose !== null && oneYearAgoClose !== 0
      ? ((lastClose - oneYearAgoClose) / oneYearAgoClose) * 100
      : null;

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
              {instrument.displaySymbol} · {instrument.exchange ?? "—"} · {instrument.currency}
            </p>
          </div>
          <FavoriteToggle instrument={instrument} />
        </div>
        <p className="text-xs text-text-muted">価格基準日 {formatDate(quote?.priceDate ?? null)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="最新終値">
          <MetricValue>
            <CurrencyValue value={quote?.close ?? null} currency={instrument.currency} />
          </MetricValue>
        </MetricCard>
        <MetricCard label="前営業日比">
          <MetricValue>
            <PercentChange amount={quote?.change ?? null} percent={quote?.changePercent ?? null} />
          </MetricValue>
        </MetricCard>
        <MetricCard label="1年騰落率">
          <MetricValue>{formatPercent(return1y)}</MetricValue>
        </MetricCard>
        <MetricCard label="配当利回り（予想）">
          <MetricValue>
            {quote?.dividendYield !== null && quote?.dividendYield !== undefined
              ? `${quote.dividendYield.toFixed(2)}%`
              : "—"}
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
              {quote?.dividendYield !== null && quote?.dividendYield !== undefined
                ? `${quote.dividendYield.toFixed(2)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">PER</dt>
            <dd className="font-semibold text-text-primary">
              {quote?.trailingPE !== null && quote?.trailingPE !== undefined ? quote.trailingPE.toFixed(2) : "—"}
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
