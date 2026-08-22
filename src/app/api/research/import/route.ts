import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { insertPasteReport, insertJsonImport } from "@/server/repositories/evidence-repository";
import { ResearchImportSchema } from "@/lib/evidence/schemas";

const sourceTypeSchema = z.enum([
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
  "official_ir",
  "edinet",
  "sec",
  "analyst",
  "investor",
  "news",
  "manual",
  "other",
]);

const pasteRequestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  mode: z.literal("paste_text"),
  sourceName: z.string().trim().min(1, "情報源の名前を入力してください。"),
  sourceType: sourceTypeSchema,
  sourceUrl: z.string().url().optional(),
  researchModel: z.string().trim().min(1).optional(),
  rawContent: z.string().trim().min(1, "本文を入力してください。").max(200_000, "本文は20万文字以内で入力してください。"),
  userNotes: z.string().trim().min(1).optional(),
});

const jsonRequestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  mode: z.literal("json"),
  json: z.unknown(),
});

const requestSchema = z.discriminatedUnion("mode", [pasteRequestSchema, jsonRequestSchema]);

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
  // （ページ側の同種のコメント参照）。先にmanual instrumentとして検索し、無ければYahoo解決にフォールバックする。
  const manualInstrument = await findInstrumentByProviderSymbol(
    supabase,
    parsed.data.providerSymbol,
    "manual"
  ).catch(() => null);
  const instrument =
    manualInstrument ?? (await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(() => null));
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    if (parsed.data.mode === "paste_text") {
      const report = await insertPasteReport(supabase, {
        userId: user.id,
        instrumentId: instrument.id,
        sourceName: parsed.data.sourceName,
        sourceType: parsed.data.sourceType,
        sourceUrl: parsed.data.sourceUrl,
        researchModel: parsed.data.researchModel,
        rawContent: parsed.data.rawContent,
        userNotes: parsed.data.userNotes,
      });
      return NextResponse.json({ data: { reportId: report.id } });
    }

    const jsonParsed = ResearchImportSchema.safeParse(parsed.data.json);
    if (!jsonParsed.success) {
      const firstIssue = jsonParsed.error.issues[0];
      const path = firstIssue?.path.join(".");
      return apiError(
        "INVALID_REQUEST",
        path ? `JSON形式が正しくありません（${path}）: ${firstIssue?.message}` : "JSON形式が正しくありません。"
      );
    }

    const result = await insertJsonImport(supabase, user.id, instrument.id, jsonParsed.data);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/research/import failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
