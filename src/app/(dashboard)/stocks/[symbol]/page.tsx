import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import { createClient } from "@/lib/supabase/server";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { listManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import { listPositions } from "@/server/repositories/positions-repository";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";
import { summarizeHolding } from "@/features/portfolio/holding-summary";
import { getVisibleDetailTabIds, type DetailTabId } from "@/features/research/visible-tabs";
import { HoldingStatusPanel } from "@/components/research/HoldingStatusPanel";
import { ManualMetricForm } from "@/components/research/ManualMetricForm";
import { ManualFundPriceHistoryForm } from "@/components/funds/ManualFundPriceHistoryForm";
import type { DailyPrice, Instrument } from "@/types/domain";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { PriceChart } from "@/components/charts/PriceChart";
import { PercentChange } from "@/components/tables/PercentChange";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { FavoriteToggle } from "@/components/search/FavoriteToggle";
import { EvidenceCoveragePanel } from "@/components/research/EvidenceCoveragePanel";
import { InstrumentDetailTabs, type InstrumentDetailTab } from "@/components/research/InstrumentDetailTabs";
import { DecisionSheet } from "@/components/candidates/DecisionSheet";
import { ResearchOutlookPanel } from "@/components/research/ResearchOutlookPanel";
import { ResearchSection } from "@/components/research/ResearchSection";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { isSampleResearchEnabled } from "@/config/research";
import { getResearchOutlook } from "@/features/research/sample-outlooks";
import {
  listResearchReports,
  listFinancialMetrics,
  listManagementStatements,
  listCompanyEvents,
  getLatestAnalysisRun,
} from "@/server/repositories/evidence-repository";
import { FinancialMetricsPanel } from "@/components/research/FinancialMetricsPanel";
import { DisclosureStatementsPanel } from "@/components/research/DisclosureStatementsPanel";
import { AiAnalysisPanel } from "@/components/research/AiAnalysisPanel";
import { formatDate, formatPercent } from "@/lib/utils/format";

function tenYearsAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function StockDetailPage({
  params,
  searchParams,
}: {
  params: { symbol: string };
  searchParams?: { tab?: string };
}) {
  const rawSymbol = decodeURIComponent(params.symbol);
  const supabase = createClient();

  // 手入力ファンドのprovider_symbolは実在のティッカーではなくファンド名から生成した文字列で、
  // 大文字小文字を区別する（英字部分を含む名前だとnormalizeProviderSymbolの大文字化で
  // 実際の値と一致しなくなるため、こちらはURLデコードした生の値でそのまま検索する）。
  const manualInstrument = await findInstrumentByProviderSymbol(
    supabase,
    rawSymbol,
    "manual"
  ).catch(() => null);

  if (manualInstrument) {
    const [priceHistory, manualResearchReports, manualFinancialMetrics, manualLatestAnalysisRun] = await Promise.all([
      listManualFundPrices(supabase, manualInstrument.id).catch(() => []),
      listResearchReports(supabase, manualInstrument.id).catch(() => []),
      listFinancialMetrics(supabase, manualInstrument.id).catch(() => []),
      getLatestAnalysisRun(supabase, manualInstrument.id).catch(() => null),
    ]);
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
    // 保有画面と同じ規則（保有ロットの基準価額と履歴のうち新しい方）で「現在の基準価額」を決め、
    // 画面間で同じファンドの価格が食い違わないようにする（Phase 0-1 / 0-3）。
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    const allFundLots = currentUser
      ? (await listPositions(supabase, currentUser.id).catch(() => [])).filter(
          (p) => p.instrument.id === manualInstrument.id
        )
      : [];
    const ownLots = allFundLots.filter((p) => p.manualUnitPrice !== null);
    const newestLot = [...ownLots].sort((a, b) => (b.manualPriceDate ?? "").localeCompare(a.manualPriceDate ?? ""))[0];
    const currentNav = fundPrice(
      { manualUnitPrice: newestLot?.manualUnitPrice ?? null, manualPriceDate: newestLot?.manualPriceDate ?? null },
      latest ? { unitPrice: latest.unit_price, priceDate: latest.price_date } : null
    );
    const previous = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2]! : null;
    const change = latest && previous ? latest.unit_price - previous.unit_price : null;
    const changePercent =
      latest && previous && previous.unit_price !== 0
        ? (change! / previous.unit_price) * 100
        : null;

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

    const fundHolding = summarizeHolding(
      allFundLots.map((p) => ({ quantity: p.quantity, avgCost: p.avgCost, nisaType: p.nisaType })),
      currentNav
    );

    const fundChart =
      dailyPrices.length >= 2 ? (
        <PriceChart dailyPrices={dailyPrices} title={instrument.name} initialMode="line" />
      ) : (
        <div className="rounded-card border border-border bg-surface p-6 text-center text-sm text-text-secondary">
          {dailyPrices.length === 0
            ? "まだ基準価額の履歴がありません。下のフォームで基準価額を記録すると、ここに推移が表示されます。"
            : "基準価額の記録が1件のみのため、グラフはまだ表示できません。次回の更新で推移が表示されます。"}
        </div>
      );

    const fundTabDefs: Partial<Record<DetailTabId, InstrumentDetailTab>> = {
      overview: {
        id: "overview",
        label: "概要",
        content: (
          <div className="space-y-4">
            {fundChart}
            <HoldingStatusPanel summary={fundHolding} currency={instrument.currency} isFund />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MetricCard label="最新基準価額（1万口あたり）">
                <MetricValue>
                  <CurrencyValue value={currentNav.displayPrice} currency={instrument.currency} kind="price" />
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
          </div>
        ),
      },
      financials: {
        id: "financials",
        label: "決算・財務",
        content: <FinancialMetricsPanel providerSymbol={manualInstrument.provider_symbol} metrics={manualFinancialMetrics} />,
      },
      research: {
        id: "research",
        label: "リサーチ",
        content: (
          <div className="space-y-4">
            <ResearchSection providerSymbol={manualInstrument.provider_symbol} reports={manualResearchReports} />
            {manualFinancialMetrics.length === 0 ? (
              <AnalyticsPanel title="決算指標を手入力">
                <ManualMetricForm providerSymbol={manualInstrument.provider_symbol} />
              </AnalyticsPanel>
            ) : null}
          </div>
        ),
      },
      "ai-analysis": {
        id: "ai-analysis",
        label: "AI分析",
        content: <AiAnalysisPanel providerSymbol={manualInstrument.provider_symbol} latestRun={manualLatestAnalysisRun} />,
      },
    };
    const fundTabs = getVisibleDetailTabIds({
      hasSampleOutlook: false,
      financialMetricCount: manualFinancialMetrics.length,
      managementStatementCount: 0,
      companyEventCount: 0,
      researchReportCount: manualResearchReports.length,
      hasAnalysisRun: manualLatestAnalysisRun !== null,
    })
      .map((id) => fundTabDefs[id])
      .filter((tab): tab is InstrumentDetailTab => tab !== undefined);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Link
            href="/portfolio"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            戻る
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{instrument.name}</h1>
              <p className="text-sm text-text-secondary">投資信託（手入力） · {instrument.currency}</p>
            </div>
            <FavoriteToggle instrument={instrument} />
          </div>
          <p className="text-xs text-text-muted">基準価額 更新日 {formatDate(currentNav.priceDate)}</p>
        </div>

        <InstrumentDetailTabs tabs={fundTabs} />

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

  const [quote, dailyPrices, existingDbInstrument] = await Promise.all([
    provider.getQuote(providerSymbol).catch(() => null),
    provider.getDailyPrices(providerSymbol, tenYearsAgoIso(), todayIso()).catch(() => []),
    findInstrumentByProviderSymbol(supabase, providerSymbol).catch(() => null),
  ]);
  const [researchReports, financialMetrics, managementStatements, companyEvents, latestAnalysisRun] = existingDbInstrument
    ? await Promise.all([
        listResearchReports(supabase, existingDbInstrument.id).catch(() => []),
        listFinancialMetrics(supabase, existingDbInstrument.id).catch(() => []),
        listManagementStatements(supabase, existingDbInstrument.id).catch(() => []),
        listCompanyEvents(supabase, existingDbInstrument.id).catch(() => []),
        getLatestAnalysisRun(supabase, existingDbInstrument.id).catch(() => null),
      ])
    : [[], [], [], [], null];

  const lastClose = dailyPrices.at(-1)?.adjustedClose ?? null;
  const oneYearAgoIndex = Math.max(0, dailyPrices.length - 253);
  const oneYearAgoClose = dailyPrices[oneYearAgoIndex]?.adjustedClose ?? null;
  const return1y =
    lastClose !== null && oneYearAgoClose !== null && oneYearAgoClose !== 0
      ? ((lastClose - oneYearAgoClose) / oneYearAgoClose) * 100
      : null;
  const sampleResearchEnabled = isSampleResearchEnabled();
  const outlook = sampleResearchEnabled ? getResearchOutlook(instrument.providerSymbol) : null;

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const stockLots =
    currentUser && existingDbInstrument
      ? (await listPositions(supabase, currentUser.id).catch(() => [])).filter(
          (p) => p.instrument.id === existingDbInstrument.id
        )
      : [];
  const stockHolding = summarizeHolding(
    stockLots.map((p) => ({ quantity: p.quantity, avgCost: p.avgCost, nisaType: p.nisaType })),
    stockPrice(quote?.close ?? null, quote?.priceDate ?? null)
  );

  const stockTabDefs: Partial<Record<DetailTabId, InstrumentDetailTab>> = {
    overview: {
      id: "overview",
      label: "概要",
      content: (
        <div className="space-y-4">
          <PriceChart dailyPrices={dailyPrices} title={instrument.name} />
          <HoldingStatusPanel summary={stockHolding} currency={instrument.currency} isFund={false} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard label="最新終値">
              <MetricValue>
                <CurrencyValue value={quote?.close ?? null} currency={instrument.currency} kind="price" />
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
            <MetricCard label="PER">
              <MetricValue>
                {quote?.trailingPE !== null && quote?.trailingPE !== undefined ? quote.trailingPE.toFixed(2) : "—"}
              </MetricValue>
            </MetricCard>
          </div>
        </div>
      ),
    },
    outlook: { id: "outlook", label: "見通し", content: <ResearchOutlookPanel outlook={outlook} /> },
    financials: {
      id: "financials",
      label: "決算・財務",
      content: <FinancialMetricsPanel providerSymbol={instrument.providerSymbol} metrics={financialMetrics} />,
    },
    statements: {
      id: "statements",
      label: "開示・発言",
      content: <DisclosureStatementsPanel statements={managementStatements} events={companyEvents} />,
    },
    evidence: {
      id: "evidence",
      label: "根拠資料",
      content: <EvidenceCoveragePanel dataKind={outlook?.dataKind ?? "unavailable"} evidence={outlook?.evidence ?? []} />,
    },
    research: {
      id: "research",
      label: "リサーチ",
      content: (
        <div className="space-y-4">
          <ResearchSection providerSymbol={instrument.providerSymbol} reports={researchReports} />
          {financialMetrics.length === 0 ? (
            <AnalyticsPanel title="決算指標を手入力">
              <ManualMetricForm providerSymbol={instrument.providerSymbol} />
            </AnalyticsPanel>
          ) : null}
        </div>
      ),
    },
    "ai-analysis": {
      id: "ai-analysis",
      label: "AI分析",
      content: <AiAnalysisPanel providerSymbol={instrument.providerSymbol} latestRun={latestAnalysisRun} />,
    },
  };
  const stockTabs = getVisibleDetailTabIds({
    hasSampleOutlook: outlook !== null,
    financialMetricCount: financialMetrics.length,
    managementStatementCount: managementStatements.length,
    companyEventCount: companyEvents.length,
    researchReportCount: researchReports.length,
    hasAnalysisRun: latestAnalysisRun !== null,
  })
    .map((id) => stockTabDefs[id])
    .filter((tab): tab is InstrumentDetailTab => tab !== undefined);

  // 判断シートは個別株の評価ツール。DBに登録済みの銘柄（候補・保有）なら常に「概要」の次に出す。
  if (existingDbInstrument) {
    stockTabs.splice(1, 0, {
      id: "decision",
      label: "判断シート",
      content: <DecisionSheet instrumentId={existingDbInstrument.id} />,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={stockHolding ? "/portfolio" : "/candidates"}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          戻る
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{instrument.name}</h1>
            <p className="text-sm text-text-secondary">
              {instrument.displaySymbol} · {instrument.exchange ?? "—"} · {instrument.currency}
            </p>
          </div>
          <FavoriteToggle instrument={instrument} />
        </div>
        <p className="text-xs text-text-muted">価格基準日 {formatDate(quote?.priceDate ?? null)}</p>
      </div>

      <InstrumentDetailTabs tabs={stockTabs} initialTabId={searchParams?.tab} />
    </div>
  );
}
