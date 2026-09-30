import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { CANDIDATE_STATUSES } from "@/lib/candidates/status";
import { updateFavoriteStatus } from "@/server/repositories/favorites-repository";

const patchSchema = z.object({ status: z.enum(CANDIDATE_STATUSES) });

export async function PATCH(request: NextRequest, { params }: { params: { instrumentId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", "状態を選んでください。");

  try {
    const updated = await updateFavoriteStatus(supabase, user.id, params.instrumentId, parsed.data.status);
    if (!updated) return apiError("NOT_FOUND", "対象の候補が見つかりませんでした。");
    return NextResponse.json({ data: { status: parsed.data.status } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
