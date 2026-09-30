import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getAssetClass } from "@/lib/domain/asset-class";
import { listFavorites } from "@/server/repositories/favorites-repository";

/** 候補（＝個別株のお気に入り）と状態。投資信託は保有資産で管理するため含めない。 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const favorites = await listFavorites(supabase, user.id);
    const data = favorites
      .filter(
        (f) => getAssetClass({ instrumentType: f.instrument.instrument_type, market: f.instrument.market }) !== "fund"
      )
      .map((f) => ({
        instrumentId: f.instrument.id,
        providerSymbol: f.instrument.provider_symbol,
        displaySymbol: f.instrument.display_symbol,
        name: f.instrument.name,
        market: f.instrument.market,
        currency: f.instrument.currency,
        status: f.status,
        addedAt: f.createdAt,
      }));
    return NextResponse.json({ data });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
