import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listPositions, upsertPosition } from "@/server/repositories/positions-repository";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
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
        const quote = await provider.getQuote(position.instrument.provider_symbol).catch(() => null);
        return {
          id: position.id,
          quantity: position.quantity,
          avgCost: position.avgCost,
          createdAt: position.createdAt,
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

const postSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  avgCost: z.coerce.number().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const instrument = await resolveOrCreateInstrument(supabase, parsed.data.providerSymbol).catch(
    () => null
  );
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    const position = await upsertPosition(
      supabase,
      user.id,
      instrument.id,
      parsed.data.quantity,
      parsed.data.avgCost ?? null
    );
    return NextResponse.json({ data: position });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
