import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { removePosition, updatePosition } from "@/server/repositories/positions-repository";
import { apiError } from "@/lib/errors/api-error";

export async function DELETE(_request: Request, { params }: { params: { positionId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await removePosition(supabase, user.id, params.positionId);
  } catch {
    return apiError("INTERNAL_ERROR");
  }

  return NextResponse.json({ data: { ok: true } });
}

const patchSchema = z
  .object({
    quantity: z.coerce.number().positive("数量は正の数で入力してください。").optional(),
    avgCost: z.coerce.number().nonnegative("取得単価は0以上で入力してください。").nullable().optional(),
    nisaType: z.enum(["tsumitate", "growth"]).nullable().optional(),
    nisaLegacy: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "変更する項目がありません。",
  });

export async function PATCH(request: NextRequest, { params }: { params: { positionId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  try {
    const updated = await updatePosition(supabase, user.id, params.positionId, parsed.data);
    if (!updated) return apiError("NOT_FOUND", "対象の保有が見つかりませんでした。");
    return NextResponse.json({ data: updated });
  } catch (error) {
    // (user, 銘柄, 口座) は一意。口座を変えた結果、同じ口座に同じ銘柄が既にある場合。
    if ((error as { code?: string }).code === "23505") {
      return apiError("INVALID_REQUEST", "変更先の口座には、同じ銘柄が既に登録されています。");
    }
    console.error("PATCH /api/positions/[positionId] failed:", error);
    return apiError("INTERNAL_ERROR");
  }
}
