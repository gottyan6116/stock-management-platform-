import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { deletePurchase } from "@/server/repositories/purchases-repository";

export async function DELETE(_request: Request, { params }: { params: { purchaseId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await deletePurchase(supabase, user.id, params.purchaseId);
  } catch {
    return apiError("INTERNAL_ERROR");
  }
  return NextResponse.json({ data: { ok: true } });
}
