import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { insertManualMetric } from "@/server/repositories/evidence-repository";
import { metricKeyValues } from "@/lib/evidence/schemas";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((value) => {
    const parts = value.split("-").map(Number);
    const year = parts[0] ?? NaN;
    const month = parts[1] ?? NaN;
    const day = parts[2] ?? NaN;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "date must be a real calendar date");

const requestSchema = z
  .object({
    providerSymbol: z.string().trim().min(1),
    metricKey: z.enum(metricKeyValues),
    value: z.number().finite("有効な数値を入力してください。"),
    unit: z.string().trim().min(1).optional(),
    currency: z.enum(["JPY", "USD"]).optional(),
    periodType: z.enum(["FY", "Q"]),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    reportedAt: isoDateSchema.optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "期間終了日は開始日より前にできません。",
    path: ["periodEnd"],
  });

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  // 手入力ファンド（provider='manual'）は大文字小文字を区別する生のprovider_symbolで登録されており、
  // resolveOrCreateInstrumentはprovider='yahoo'固定・シンボルを大文字化してしまうため一致しない
  // （src/app/api/research/import/route.ts、src/app/(dashboard)/stocks/[symbol]/page.tsxの同種コメント参照）。
  // 先にmanual instrumentとして検索し、無ければYahoo解決にフォールバックする。
  const manualInstrument = await findInstrumentByProviderSymbol(
    supabase,
    parsed.data.providerSymbol,
    "manual"
  ).catch(() => null);
  const instrument =
    manualInstrument ?? (await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(() => null));
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    const metric = await insertManualMetric(supabase, {
      userId: user.id,
      instrumentId: instrument.id,
      metricKey: parsed.data.metricKey,
      value: parsed.data.value,
      unit: parsed.data.unit,
      currency: parsed.data.currency,
      periodType: parsed.data.periodType,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      reportedAt: parsed.data.reportedAt,
    });
    return NextResponse.json({ data: { metricId: metric.id } });
  } catch (err) {
    console.error("POST /api/research/metrics failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
