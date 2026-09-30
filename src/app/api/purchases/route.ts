import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { todayJst } from "@/lib/utils/format";
import { insertPurchase, listPurchasesForYear } from "@/server/repositories/purchases-repository";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const yearParam = Number(request.nextUrl.searchParams.get("year"));
  const year =
    Number.isInteger(yearParam) && yearParam >= 2024 && yearParam <= 2100 ? yearParam : Number(todayJst().slice(0, 4));

  try {
    return NextResponse.json({ data: await listPurchasesForYear(supabase, user.id, year) });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const postSchema = z.object({
  instrumentId: z.string().uuid(),
  nisaType: z.enum(["tsumitate", "growth"]),
  tradedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を選んでください。"),
  amountJpy: z.coerce.number().positive("金額は正の数で入力してください。").max(100_000_000),
  quantity: z.coerce.number().positive().optional(),
});

/** NISAの買付を1件記録する（年間投資枠の消化額の元データ）。 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);
  if (parsed.data.tradedOn > todayJst()) return apiError("INVALID_REQUEST", "未来の日付は記録できません。");

  try {
    const created = await insertPurchase(supabase, { userId: user.id, ...parsed.data });
    return NextResponse.json({ data: created });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
