import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import { createClient } from "@/lib/supabase/server";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { listManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import { ManualFundPriceHistoryForm } from "@/components/funds/ManualFundPriceHistoryForm";
import type { DailyPrice, Instrument } from "@/types/domain";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { PriceChart } from "@/components/charts/PriceChart";
import { PercentChange } from "@/components/tables/PercentChange";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { formatDate, formatDateTime, formatPercent } from "@/lib/utils/format";

function tenYearsAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function StockDetailPage({ params }: { params: { symbol: string } }) {
  const rawSymbol = decodeURIComponent(params.symbol);
  const supabase = createClient();

  // 手入力ファンドのprovider_symbolは実在のティッカーではなくファンド名から生成した文字列で、
  // 大文字小文字を区別する（英字部分を含む名前だとnormalizeProviderSymbolの大文字化で
  // 実際の値と一致しなくなるため、こちらはURLデコードした生の値でそのまま検索する）。
  const manualInstrument = await findInstrumentByProviderSymbol(supabase, rawSymbol, "manual").catch(
    () => null
  );

  if (manualInstrument) {
    const priceHistory = await listManualFundPrices(supabase, manualInstrument.id).catch(() => []);
    const dailyPrices: DailyPrice[] = priceHistory.map((row) => ({
      tradingDate: row.price_date,
      open: row.unit_price,
      high: row.unit_price,
      low: row.unit_price,
      close: row.unit_price,
      adjustedClose: row.unit_price,
      volume: null,
    }));

    const latest = priceHistory.at(-1) ?? null;
    const previous = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2]! : null;
    const change = latest && previous ? latest.unit_price - previous.unit_price : null;
    const changePercent =
      latest && previous && previous.unit_price !== 0 ? (change! / previous.unit_price) * 100 : null;

    const instrument: Instrument = {
      id: manualInstrument.id,
      providerSymbol: manualInstrument.provider_symbol,
      displaySymbol: manualInstrument.display_symbol,
      name: manualInstrument.name,
      exchange: manualInstrument.exchange,
      market: manualInstrument.market,
      currency: manualInstrument.currency,
      instrumentType: manualInstrument.instrument_type,
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Link
            href="/funds"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            戻る
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-primary md:text-[30px]">{instrument.name}</h1>
              <p className="text-sm text-text-secondary">投資信託（手入力） · {instrument.currency}</p>
            </div>
            <FavoriteToggle instrument={instrument} />
          </div>
          <p className="text-xs text-text-muted">基準価額 更新日 {formatDate(latest?.price_date ?? null)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard label="最新基準価額（1万口あたり）">
            <MetricValue>
              <CurrencyValue value={latest?.unit_price ?? null} currency={instrument.currency} />
            </MetricValue>
          </MetricCard>
          <MetricCard label="前回更新比">
            <MetricValue>
              <PercentChange amount={change} percent={changePercent} />
            </MetricValue>
          </MetricCard>
          <MetricCard label="更新回数">
            <MetricValue>{priceHistory.length}回</MetricValue>
          </MetricCard>
        </div>

        {dailyPrices.length >= 2 ? (
          <PriceChart dailyPrices={dailyPrices} title={instrument.name} initialMode="line" />
        ) : (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-secondary">
            {dailyPrices.length === 0
              ? "まだ基準価額の履歴がありません。ポートフォリオで基準価額を入力すると、ここに履歴が記録されます。"
              : "基準価額の記録が1件のみのため、グラフはまだ表示できません。次回の更新で推移が表示されます。"}
          </div>
        )}

        <div className="rounded-card border border-border bg-surface p-5 text-xs text-text-muted">
          この銘柄はYahoo Financeにデータが無い投資信託のため、基準価額はポートフォリオ画面での手入力に基づきます。
          自動更新は行われません。最終取得: {formatDateTime(latest?.fetched_at ?? null)}
        </div>

        <ManualFundPriceHistoryForm instrumentId={manualInstrument.id} />
      </div>
    );
  }

  const providerSymbol = normalizeProviderSymbol(rawSymbol);
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
