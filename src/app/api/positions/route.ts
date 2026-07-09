import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listPositions, upsertPosition } from "@/server/repositories/positions-repository";
import { addFavorite } from "@/server/repositories/favorites-repository";
import { upsertManualFundPrice } from "@/server/repositories/manual-fund-prices-repository";
import {
  resolveOrCreateInstrument,
  resolveOrCreateManualFundInstrument,
} from "@/server/services/resolve-instrument";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { apiError } from "@/lib/errors/api-error";

// 投資信託(口数ベース)の基準価額は「10,000口あたり」の慣行で表示される。
const FUND_UNIT_DIVISOR = 10000;

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
        const isFundUnitBased = position.isManual && position.instrument.instrument_type === "fund";

        if (isFundUnitBased) {
          const lastClose = position.manualUnitPrice !== null ? position.manualUnitPrice / FUND_UNIT_DIVISOR : null;
          return {
            id: position.id,
            quantity: position.quantity,
            avgCost: position.avgCost !== null ? position.avgCost / FUND_UNIT_DIVISOR : null,
            nisaType: position.nisaType,
            isManual: true,
            providerSymbol: position.instrument.provider_symbol,
            displaySymbol: position.instrument.display_symbol,
            name: position.instrument.name,
            exchange: position.instrument.exchange,
            market: position.instrument.market,
            currency: position.instrument.currency,
            instrumentType: position.instrument.instrument_type,
            priceDate: position.manualPriceDate,
            fetchedAt: position.manualPriceDate,
            lastClose,
            change: null,
            changePercent: null,
          };
        }

        const quote = await provider.getQuote(position.instrument.provider_symbol).catch(() => null);
        return {
          id: position.id,
          quantity: position.quantity,
          avgCost: position.avgCost,
          nisaType: position.nisaType,
          isManual: position.isManual,
          providerSymbol: position.instrument.provider_symbol,
          displaySymbol: position.instrument.display_symbol,
          name: position.instrument.name,
          exchange: position.instrument.exchange,
          market: position.instrument.market,
          currency: position.instrument.currency,
          instrumentType: position.instrument.instrument_type,
          priceDate: quote?.priceDate ?? null,
          fetchedAt: quote?.fetchedAt ?? null,
          lastClose: quote?.close ?? null,
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
