import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeFavorite } from "@/server/repositories/favorites-repository";
import { apiError } from "@/lib/errors/api-error";

export async function DELETE(
  _request: Request,
  { params }: { params: { instrumentId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await removeFavorite(supabase, user.id, params.instrumentId);
  } catch {
    return apiError("INTERNAL_ERROR");
  }

  return NextResponse.json({ data: { ok: true } });
}
