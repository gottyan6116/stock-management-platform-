import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeSimulationTrade } from "@/server/repositories/simulation-repository";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { apiError } from "@/lib/errors/api-error";

const postSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  side: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().positive(),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const instrument = await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(() => null);
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  const provider = getMarketDataProvider();
  const quote = await provider.getQuote(instrument.provider_symbol).catch(() => null);
  if (!quote || quote.close === null) {
    return apiError("PROVIDER_ERROR", "現在値を取得できなかったため売買を実行できませんでした。");
  }

  try {
    await executeSimulationTrade(supabase, user.id, instrument, parsed.data.side, parsed.data.quantity, quote.close);
    return NextResponse.json({ data: { executedPrice: quote.close } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "取引に失敗しました。";
    return apiError("INVALID_REQUEST", message);
  }
}
