import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { listFavorites } from "@/server/repositories/favorites-repository";
import { listPositions } from "@/server/repositories/positions-repository";
import { listLatestManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";
import { computeReturn1y, toSparkline } from "@/lib/pricing/history-metrics";
import type { FavoriteQuoteApiItem } from "@/features/favorites/quotes";

const HISTORY_LOOKBACK_DAYS = 400; // 約1年分の営業日(252)＋余裕

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * お気に入り銘柄の実際の価格。以前はモックの正規化系列（基準価格100）を表示しており、
 * 保有画面と終値が食い違っていた（Phase 0-1）。保有画面と同じ instrument-price を経由する。
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const [favorites, positions] = await Promise.all([listFavorites(supabase, user.id), listPositions(supabase, user.id)]);
    const positionByInstrument = new Map(positions.map((p) => [p.instrument.id, p]));
    const provider = getMarketDataProvider();
    const today = isoDaysAgo(0);
    const from = isoDaysAgo(HISTORY_LOOKBACK_DAYS);

    const data: FavoriteQuoteApiItem[] = await Promise.all(
      favorites.map(async ({ instrument }): Promise<FavoriteQuoteApiItem> => {
        if (instrument.instrument_type === "fund") {
          const history = await listLatestManualFundPrices(supabase, instrument.id, 2).catch(() => []);
          const position = positionByInstrument.get(instrument.id);
          const price = fundPrice(
            { manualUnitPrice: position?.manualUnitPrice ?? null, manualPriceDate: position?.manualPriceDate ?? null },
            history[0] ? { unitPrice: history[0].unit_price, priceDate: history[0].price_date } : null
          );
          // 前回比は履歴に2点以上あるときだけ（1点しか無ければ null。0にはしない）。
          const previous = history[1]?.unit_price ?? null;
          const change = price.displayPrice !== null && previous !== null ? price.displayPrice - previous : null;
          return {
            providerSymbol: instrument.provider_symbol,
            displayPrice: price.displayPrice,
            unitDivisor: price.unitDivisor,
            previousPrice: previous,
            change,
            changePercent: change !== null && previous ? (change / previous) * 100 : null,
            dividendYield: null,
            priceDate: price.priceDate,
            fetchedAt: price.priceDate,
            return1y: null,
            sparkline: [],
          };
        }

        const [quote, prices] = await Promise.all([
          provider.getQuote(instrument.provider_symbol).catch(() => null),
          provider.getDailyPrices(instrument.provider_symbol, from, today).catch(() => []),
        ]);
        const price = stockPrice(quote?.close ?? null, quote?.priceDate ?? null);
        return {
          providerSymbol: instrument.provider_symbol,
          displayPrice: price.displayPrice,
          unitDivisor: price.unitDivisor,
          previousPrice: quote?.previousClose ?? null,
          change: quote?.change ?? null,
          changePercent: quote?.changePercent ?? null,
          dividendYield: quote?.dividendYield ?? null,
          priceDate: price.priceDate,
          fetchedAt: quote?.fetchedAt ?? null,
          return1y: computeReturn1y(prices),
          sparkline: toSparkline(prices, 52),
        };
      })
    );

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/favorites/quotes failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
