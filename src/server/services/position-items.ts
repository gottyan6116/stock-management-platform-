import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { PositionApiItem } from "@/features/portfolio/types";
import { FUND_UNIT_DIVISOR, getAssetClass } from "@/lib/domain/asset-class";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { listLatestManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import { listPositions } from "@/server/repositories/positions-repository";

/**
 * ユーザーの保有に最新価格を付けて返す。画面（GET /api/positions）と日次スナップショットで
 * 同じ価格ルール・同じ数量を使うための単一の入口。
 * supabase には、ユーザーのセッションclient、またはservice roleのclient（cronから）を渡せる。
 */
export async function buildPositionItems(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PositionApiItem[]> {
  const positions = await listPositions(supabase, userId);
    const provider = getMarketDataProvider();

    const data = await Promise.all(
      positions.map(async (position) => {
        const assetClass = getAssetClass({
          instrumentType: position.instrument.instrument_type,
          market: position.instrument.market,
        });
        const isFundUnitBased = position.isManual && position.instrument.instrument_type === "fund";

        const common = {
          id: position.id,
          instrumentId: position.instrument.id,
          quantity: position.quantity,
          nisaType: position.nisaType,
          nisaLegacy: position.nisaLegacy,
          providerSymbol: position.instrument.provider_symbol,
          displaySymbol: position.instrument.display_symbol,
          name: position.instrument.name,
          exchange: position.instrument.exchange,
          market: position.instrument.market,
          currency: position.instrument.currency,
          instrumentType: position.instrument.instrument_type,
          assetClass,
        };

        if (isFundUnitBased) {
          // 基準価額は保有ロットの値と履歴テーブルのうち新しい方（画面間で1銘柄1価格にする）。
          const history = await listLatestManualFundPrices(supabase, position.instrument.id, 1).catch(() => []);
          const price = fundPrice(
            { manualUnitPrice: position.manualUnitPrice, manualPriceDate: position.manualPriceDate },
            history[0] ? { unitPrice: history[0].unit_price, priceDate: history[0].price_date } : null
          );
          return {
            ...common,
            avgCost: position.avgCost !== null ? position.avgCost / FUND_UNIT_DIVISOR : null,
            isManual: true,
            priceDate: price.priceDate,
            fetchedAt: price.priceDate,
            displayPrice: price.displayPrice,
            unitDivisor: price.unitDivisor,
            lastClose: price.displayPrice !== null ? price.displayPrice / price.unitDivisor : null,
            change: null,
            changePercent: null,
          };
        }

        const quote = await provider.getQuote(position.instrument.provider_symbol).catch(() => null);
        const price = stockPrice(quote?.close ?? null, quote?.priceDate ?? null);
        return {
          ...common,
          avgCost: position.avgCost,
          isManual: position.isManual,
          priceDate: price.priceDate,
          fetchedAt: quote?.fetchedAt ?? null,
          displayPrice: price.displayPrice,
          unitDivisor: price.unitDivisor,
          lastClose: price.displayPrice,
          change: quote?.change ?? null,
          changePercent: quote?.changePercent ?? null,
        };
      })
    );

  return data;
}
