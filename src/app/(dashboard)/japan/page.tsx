import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { MarketPageDashboard } from "@/components/markets/MarketPageDashboard";
import { buildMockIndexSeries } from "@/lib/mock/market-index";
import { JAPAN_FEATURED_SYMBOLS } from "@/config/watchlist";
import { toFreshnessInfo } from "@/lib/utils/freshness";
import { formatCurrency } from "@/lib/utils/format";

export default function JapanPage() {
  const nikkei = buildMockIndexSeries("nikkei225", 38787.38);
  const usdJpy = buildMockIndexSeries("usdjpy", 151.0);
  const topix = buildMockIndexSeries("topix", 2748.12);

  const freshness = toFreshnessInfo({ priceDate: nikkei.quote.priceDate, fetchedAt: nikkei.quote.fetchedAt });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="日本株" freshness={freshness} />
      <MarketPageDashboard
        market="JP"
        marketLabel="日本株"
        index={{ name: "日経平均株価", quote: nikkei.quote, dailyPrices: nikkei.dailyPrices }}
        overviewRows={[
          { label: "日経平均株価", value: formatCurrency(nikkei.quote.close, "JPY") },
          { label: "TOPIX", value: topix.quote.close?.toFixed(2) ?? "—" },
          { label: "ドル円", value: usdJpy.quote.close?.toFixed(2) ?? "—" },
        ]}
        featuredSymbols={JAPAN_FEATURED_SYMBOLS}
      />
    </div>
  );
}
