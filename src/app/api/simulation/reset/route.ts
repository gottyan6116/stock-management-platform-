import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resetSimulation } from "@/server/repositories/simulation-repository";
import { apiError } from "@/lib/errors/api-error";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    await resetSimulation(supabase, user.id);
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
