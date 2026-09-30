import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { deleteDecisionRecord } from "@/server/repositories/candidates-repository";

export async function DELETE(_request: Request, { params }: { params: { decisionId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await deleteDecisionRecord(supabase, user.id, params.decisionId);
  } catch {
    return apiError("INTERNAL_ERROR");
  }
  return NextResponse.json({ data: { ok: true } });
}
