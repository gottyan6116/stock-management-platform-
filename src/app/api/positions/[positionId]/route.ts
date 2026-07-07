import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removePosition } from "@/server/repositories/positions-repository";
import { apiError } from "@/lib/errors/api-error";

export async function DELETE(_request: Request, { params }: { params: { positionId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await removePosition(supabase, user.id, params.positionId);
  } catch {
    return apiError("INTERNAL_ERROR");
  }

  return NextResponse.json({ data: { ok: true } });
}
