import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listPositions, upsertPosition } from "@/server/repositories/positions-repository";
import { addFavorite } from "@/server/repositories/favorites-repository";
import {
  listLatestManualFundPrices,
  upsertManualFundPrice,
} from "@/server/repositories/manual-fund-prices-repository";
import { FUND_UNIT_DIVISOR, getAssetClass } from "@/lib/domain/asset-class";
import { fundPrice, stockPrice } from "@/lib/pricing/instrument-price";
import {
  resolveOrCreateInstrument,
  resolveOrCreateManualFundInstrument,
} from "@/server/services/resolve-instrument";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { apiError } from "@/lib/errors/api-error";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const positions = await listPositions(supabase, user.id);
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

    return NextResponse.json({ data });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const postSchema = z
  .object({
    providerSymbol: z.string().trim().min(1).optional(),
    manualName: z.string().trim().min(1).optional(),
    manualUnitPrice: z.coerce.number().nonnegative().optional(),
    quantity: z.coerce.number().positive(),
    avgCost: z.coerce.number().nonnegative().optional(),
    nisaType: z.enum(["tsumitate", "growth"]).optional(),
  })
  .refine((data) => Boolean(data.providerSymbol) || Boolean(data.manualName), {
    message: "providerSymbolまたはmanualNameのいずれかが必要です。",
  });

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const isManual = Boolean(parsed.data.manualName);

  const instrument = isManual
    ? await resolveOrCreateManualFundInstrument(parsed.data.manualName!).catch(() => null)
    : await resolveOrCreateInstrument(parsed.data.providerSymbol!).catch(() => null);
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    const position = await upsertPosition(supabase, {
      userId: user.id,
      instrumentId: instrument.id,
      quantity: parsed.data.quantity,
      avgCost: parsed.data.avgCost ?? null,
      nisaType: parsed.data.nisaType ?? null,
      isManual,
      manualUnitPrice: parsed.data.manualUnitPrice ?? null,
    });

    // 手入力ファンドは投資信託ページにも表示されるよう、お気に入りにも自動登録する。
    if (isManual) {
      await addFavorite(supabase, user.id, instrument.id).catch((error: { code?: string }) => {
        if (error.code !== "23505") throw error;
      });

      // 基準価額の履歴を記録する（詳細ページのチャート用）。instrumentsと同様に共有データなのでservice role書き込み。
      if (parsed.data.manualUnitPrice !== undefined) {
        const serviceClient = createServiceRoleClient();
        await upsertManualFundPrice(
          serviceClient,
          instrument.id,
          parsed.data.manualUnitPrice,
          new Date().toISOString().slice(0, 10)
        ).catch(() => null);
      }
    }

    return NextResponse.json({ data: position });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
