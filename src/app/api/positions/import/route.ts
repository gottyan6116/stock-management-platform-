import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { todayJst } from "@/lib/utils/format";
import { applyFundImportPlan, buildFundImportPlan } from "@/server/services/fund-import";

const numberOrNull = z.number().finite().nonnegative().nullable();

const bodySchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        nisaType: z.enum(["tsumitate", "growth"]).nullable(),
        accountLabel: z.string().max(50),
        quantity: z.number().finite().positive(),
        avgCostPer10k: numberOrNull,
        nav: numberOrNull,
        totalCost: numberOrNull,
      })
    )
    .min(1, "取り込む行がありません。")
    .max(200),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** false（既定）はプレビューのみでDBを変更しない。 */
  apply: z.boolean().default(false),
});

/** 楽天証券の投資信託CSV取込。プレビューと反映は同じ計画関数を通る。 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const asOf = parsed.data.asOf ?? todayJst();

  try {
    const plan = await buildFundImportPlan(supabase, user.id, parsed.data.rows);
    if (!parsed.data.apply) return NextResponse.json({ data: { plan, asOf, applied: null } });

    const applied = await applyFundImportPlan(supabase, user.id, plan, asOf);
    return NextResponse.json({ data: { plan, asOf, applied } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
