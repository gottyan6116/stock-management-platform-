import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchManualFundInstruments } from "@/server/repositories/instruments-repository";
import { apiError } from "@/lib/errors/api-error";

const querySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/**
 * 自分が過去に手入力登録した投資信託名のみを候補表示する（Yahoo等の外部発見検索は行わない）。
 * クエリが空の場合は登録済みファンドを一覧表示し、既存登録からの再選択を助ける。
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);
  const { q, limit } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const rows = await searchManualFundInstruments(supabase, q, limit);
  return NextResponse.json({
    data: rows.map((row) => ({ id: row.id, name: row.name, providerSymbol: row.provider_symbol })),
  });
}
