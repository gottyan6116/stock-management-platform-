import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getUsdJpy } from "@/server/services/fx";

/**
 * ドル円レート（円換算の総資産に使う）。取得に失敗した場合は data: null を返し、
 * 画面側はUSD分を換算せずに「レート未取得」と明示する（レートを仮定して表示しない）。
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const fx = await getUsdJpy();
  return NextResponse.json({ data: fx ? { usdJpy: fx.usdJpy, asOf: fx.asOf } : null });
}
