import type { FxRate } from "@/lib/portfolio/valuation";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";

/** ドル円レート。取得できなければ null（レートを仮定しない）。 */
export async function getUsdJpy(): Promise<FxRate | null> {
  const quote = await getMarketDataProvider()
    .getQuote("USDJPY=X")
    .catch(() => null);
  if (!quote || quote.close === null || !(quote.close > 0)) return null;
  return { usdJpy: quote.close, asOf: quote.fetchedAt };
}
