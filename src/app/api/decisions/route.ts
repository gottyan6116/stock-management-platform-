import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { getAssetClass } from "@/lib/domain/asset-class";
import { scenarioInputsSchema } from "@/lib/candidates/scenarios";
import { HORIZON_YEARS } from "@/lib/candidates/expected-return";
import { todayJst } from "@/lib/utils/format";
import { updateFavoriteStatus } from "@/server/repositories/favorites-repository";
import {
  getUserSettings,
  insertDecisionRecord,
  listDecisionRecords,
} from "@/server/repositories/candidates-repository";
import { buildDecisionsResult } from "@/server/services/decision-outcomes";
import { computeAllScenarios, getBenchmarkInfo, getDecisionMarket } from "@/server/services/decision-market";

export const dynamic = "force-dynamic";

/** 判断の記録一覧と、1年後・3年後の答え合わせ、対オルカン勝率。 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const records = await listDecisionRecords(supabase, user.id);
    return NextResponse.json({ data: await buildDecisionsResult(supabase, records) });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}

const postSchema = z.object({
  instrumentId: z.string().uuid(),
  decision: z.enum(["buy", "pass"]),
  thesisWhy: z.string().max(2000),
  thesisWrong: z.string().max(2000),
  scenarios: scenarioInputsSchema,
});

/**
 * 「購入判断として記録」「見送りとして記録」。押した時点の価格・配当利回り・PER・ハードル・
 * オルカンの基準価額・前提と計算結果を、書き換えられない記録として保存する。
 * 価格などの数値はクライアントから受け取らず、サーバーが取得・計算する。
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);
  const input = parsed.data;

  const { data: instrument } = await supabase.from("instruments").select("*").eq("id", input.instrumentId).maybeSingle();
  if (!instrument || getAssetClass({ instrumentType: instrument.instrument_type, market: instrument.market }) === "fund") {
    return apiError("NOT_FOUND", "個別株の銘柄が見つかりませんでした。");
  }

  try {
    const market = await getDecisionMarket(instrument.provider_symbol, instrument.currency);
    if (market.price === null) {
      return apiError("INVALID_REQUEST", "現在の株価を取得できないため記録できません。時間をおいて再度お試しください。");
    }

    const settings = await getUserSettings(supabase, user.id).catch(() => null);
    const benchmark = await getBenchmarkInfo(supabase, settings?.benchmark_instrument_id ?? null);
    const results = computeAllScenarios(market, input.scenarios);

    await insertDecisionRecord(supabase, {
      user_id: user.id,
      instrument_id: instrument.id,
      decision: input.decision,
      decided_on: todayJst(),
      price: market.price,
      currency: instrument.currency,
      dividend_yield: market.dividendYieldPct,
      current_per: market.currentPer,
      thesis_why: input.thesisWhy,
      thesis_wrong: input.thesisWrong,
      scenarios: { horizonYears: HORIZON_YEARS, inputs: input.scenarios, results },
      hurdle_return: settings?.benchmark_expected_return ?? null,
      benchmark_instrument_id: benchmark?.instrumentId ?? null,
      benchmark_nav: benchmark?.nav ?? null,
      benchmark_nav_date: benchmark?.navDate ?? null,
    });

    // 判断を記録したら候補の状態も追随させる（候補でなければ何もしない）。
    await updateFavoriteStatus(
      supabase,
      user.id,
      instrument.id,
      input.decision === "buy" ? "purchased" : "passed"
    ).catch(() => false);

    return NextResponse.json({ data: { ok: true } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
