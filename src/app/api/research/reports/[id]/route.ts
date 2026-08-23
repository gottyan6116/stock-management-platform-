import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { deleteResearchReport, updateResearchReport } from "@/server/repositories/evidence-repository";

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

const patchSchema = z.object({
  sourceName: z.string().trim().min(1).optional(),
  sourceType: sourceTypeSchema.optional(),
  sourceUrl: z.string().trim().url().optional(),
  researchModel: z.string().trim().optional(),
  rawContent: z.string().trim().min(1, "本文を入力してください。").max(200_000, "本文は20万文字以内で入力してください。").optional(),
  userNotes: z.string().trim().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  try {
    const updated = await updateResearchReport(supabase, user.id, params.id, parsed.data);
    if (!updated) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "UNSUPPORTED_MODE") {
      return apiError("INVALID_REQUEST", "JSON形式で取り込まれた資料は編集できません。削除して再度取り込んでください。");
    }
    console.error("PATCH /api/research/reports/[id] failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const deleted = await deleteResearchReport(supabase, user.id, params.id);
    if (!deleted) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("DELETE /api/research/reports/[id] failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
