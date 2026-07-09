import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { bulkUpsertManualFundPrices } from "@/server/repositories/manual-fund-prices-repository";
import { apiError } from "@/lib/errors/api-error";

const bodySchema = z.object({
  rows: z
    .array(
      z.object({
        priceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        unitPrice: z.coerce.number().positive(),
      })
    )
    .min(1)
    .max(2000),
});

/** 証券会社の投信ページで見える過去の基準価額を、日付+価格の配列で一括取り込みする。 */
export async function POST(request: NextRequest, { params }: { params: { instrumentId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  try {
    const serviceClient = createServiceRoleClient();
    await bulkUpsertManualFundPrices(serviceClient, params.instrumentId, parsed.data.rows);
    return NextResponse.json({ data: { count: parsed.data.rows.length } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
