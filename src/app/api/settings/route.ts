import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getUserSettings, upsertUserSettings } from "@/server/repositories/candidates-repository";
import { listPositions } from "@/server/repositories/positions-repository";

/** オルカンの想定年率リターン（ハードル）と、比較に使う銘柄（保有中の投資信託から選ぶ）。 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const [settings, positions] = await Promise.all([
      getUserSettings(supabase, user.id).catch(() => null),
      listPositions(supabase, user.id),
    ]);
    const funds = new Map<string, string>();
    for (const p of positions) if (p.instrument.instrument_type === "fund") funds.set(p.instrument.id, p.instrument.name);

    return NextResponse.json({
      data: {
        benchmarkExpectedReturn: settings?.benchmark_expected_return ?? null,
        benchmarkInstrumentId: settings?.benchmark_instrument_id ?? null,
        fundChoices: [...funds.entries()].map(([id, name]) => ({ id, name })),
      },
    });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const putSchema = z.object({
  benchmarkExpectedReturn: z
    .number()
    .finite()
    .min(-20, "想定年率は−20%〜30%で入力してください。")
    .max(30, "想定年率は−20%〜30%で入力してください。")
    .nullable(),
  benchmarkInstrumentId: z.string().uuid().nullable(),
});

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  try {
    await upsertUserSettings(supabase, user.id, parsed.data);
    return NextResponse.json({ data: parsed.data });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
