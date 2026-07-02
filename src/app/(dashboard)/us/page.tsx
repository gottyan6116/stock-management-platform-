import { DashboardHeader } from "@/components/app-shell/DashboardHeader";
import { MarketPageDashboard } from "@/components/markets/MarketPageDashboard";
import { buildMockIndexSeries } from "@/lib/mock/market-index";
import { US_FEATURED_SYMBOLS } from "@/config/watchlist";
import { toFreshnessInfo } from "@/lib/utils/freshness";

export default function UsPage() {
  const sp500 = buildMockIndexSeries("sp500", 5460.5);
  const nasdaq = buildMockIndexSeries("nasdaq-composite", 17700.2);
  const usdJpy = buildMockIndexSeries("usdjpy", 151.0);

  const freshness = toFreshnessInfo({ priceDate: sp500.quote.priceDate, fetchedAt: sp500.quote.fetchedAt });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader title="米国株" freshness={freshness} />
      <MarketPageDashboard
        market="US"
        marketLabel="米国株"
        index={{ name: "S&P 500", quote: sp500.quote, dailyPrices: sp500.dailyPrices }}
        overviewRows={[
          { label: "S&P 500", value: sp500.quote.close?.toFixed(2) ?? "—" },
          { label: "NASDAQ Composite", value: nasdaq.quote.close?.toFixed(2) ?? "—" },
          { label: "USD/JPY", value: usdJpy.quote.close?.toFixed(2) ?? "—" },
        ]}
        featuredSymbols={US_FEATURED_SYMBOLS}
      />
    </div>
  );
}
