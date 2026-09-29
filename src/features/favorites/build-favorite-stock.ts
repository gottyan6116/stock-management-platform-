import type { FavoriteStock, Instrument, Quote } from "@/types/domain";
import type { FavoriteQuoteApiItem } from "./quotes";

/**
 * お気に入り一覧の1行を、実データ(FavoriteQuoteApiItem)から作る。
 * 価格が取得できなかった銘柄は close=null（画面では「—」）にし、ダミー値で埋めない。
 */
export function buildFavoriteStock(
  instrument: Instrument,
  quote: FavoriteQuoteApiItem | undefined,
  favoritedAt: string
): FavoriteStock {
  const domainQuote: Quote = {
    instrumentId: instrument.id,
    priceDate: quote?.priceDate ?? "",
    fetchedAt: quote?.fetchedAt ?? "",
    close: quote?.displayPrice ?? null,
    previousClose: quote?.previousPrice ?? null,
    change: quote?.change ?? null,
    changePercent: quote?.changePercent ?? null,
    dividendYield: quote?.dividendYield ?? null,
    marketCap: null,
    trailingPE: null,
  };
  return {
    instrument,
    quote: domainQuote,
    return1y: quote?.return1y ?? null,
    sparkline: quote?.sparkline ?? [],
    favoritedAt,
  };
}
