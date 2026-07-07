import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addFavorite, listFavorites } from "@/server/repositories/favorites-repository";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { apiError } from "@/lib/errors/api-error";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const favorites = await listFavorites(supabase, user.id);
    return NextResponse.json({
      data: favorites.map((f) => ({
        id: f.instrument.id,
        favoriteId: f.id,
        createdAt: f.createdAt,
        providerSymbol: f.instrument.provider_symbol,
        displaySymbol: f.instrument.display_symbol,
        name: f.instrument.name,
        exchange: f.instrument.exchange,
        market: f.instrument.market,
        currency: f.instrument.currency,
        instrumentType: f.instrument.instrument_type,
      })),
    });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const postSchema = z.object({ providerSymbol: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST");

  const instrument = await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(
    () => null
  );
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    await addFavorite(supabase, user.id, instrument.id);
  } catch (error) {
    // unique制約違反(重複お気に入り)は成功扱いにする（設計書12.2 冪等性）。
    const code = (error as { code?: string }).code;
    if (code !== "23505") return apiError("INTERNAL_ERROR");
  }

  return NextResponse.json({
    data: {
      id: instrument.id,
      providerSymbol: instrument.provider_symbol,
      displaySymbol: instrument.display_symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      market: instrument.market,
      currency: instrument.currency,
      instrumentType: instrument.instrument_type,
    },
  });
}
