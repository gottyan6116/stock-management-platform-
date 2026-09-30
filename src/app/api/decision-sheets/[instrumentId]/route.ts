import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getAssetClass } from "@/lib/domain/asset-class";
import { parseScenarios, scenarioInputsSchema } from "@/lib/candidates/scenarios";
import {
  getDecisionSheet,
  getUserSettings,
  upsertDecisionSheet,
} from "@/server/repositories/candidates-repository";
import { getBenchmarkInfo, getDecisionMarket } from "@/server/services/decision-market";

async function loadStock(supabase: ReturnType<typeof createClient>, instrumentId: string) {
  const { data } = await supabase.from("instruments").select("*").eq("id", instrumentId).maybeSingle();
  if (!data) return null;
  if (getAssetClass({ instrumentType: data.instrument_type, market: data.market }) === "fund") return null;
  return data;
}

/** 判断シートの下書きと、自動取得する前提（現在値・配当利回り・PER）、ハードル。 */
export async function GET(_request: Request, { params }: { params: { instrumentId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const instrument = await loadStock(supabase, params.instrumentId);
  if (!instrument) return apiError("NOT_FOUND", "個別株の銘柄が見つかりませんでした。");

  try {
    const [sheet, settings, market] = await Promise.all([
      getDecisionSheet(supabase, user.id, instrument.id).catch(() => null),
      getUserSettings(supabase, user.id).catch(() => null),
      getDecisionMarket(instrument.provider_symbol, instrument.currency),
    ]);
    const benchmark = await getBenchmarkInfo(supabase, settings?.benchmark_instrument_id ?? null);

    return NextResponse.json({
      data: {
        instrument: { id: instrument.id, name: instrument.name, displaySymbol: instrument.display_symbol },
        market,
        sheet: {
          thesisWhy: sheet?.thesis_why ?? "",
          thesisWrong: sheet?.thesis_wrong ?? "",
          scenarios: parseScenarios(sheet?.scenarios),
        },
        hurdlePct: settings?.benchmark_expected_return ?? null,
        benchmark,
      },
    });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const putSchema = z.object({
  thesisWhy: z.string().max(2000),
  thesisWrong: z.string().max(2000),
  scenarios: scenarioInputsSchema,
});

export async function PUT(request: NextRequest, { params }: { params: { instrumentId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const instrument = await loadStock(supabase, params.instrumentId);
  if (!instrument) return apiError("NOT_FOUND", "個別株の銘柄が見つかりませんでした。");

  try {
    await upsertDecisionSheet(supabase, user.id, instrument.id, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
