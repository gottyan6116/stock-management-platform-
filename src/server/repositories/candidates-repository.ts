import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type SettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
type SheetRow = Database["public"]["Tables"]["decision_sheets"]["Row"];
type RecordRow = Database["public"]["Tables"]["decision_records"]["Row"];
type RecordInsert = Database["public"]["Tables"]["decision_records"]["Insert"];

export async function getUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Pick<SettingsRow, "benchmark_expected_return" | "benchmark_instrument_id"> | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("benchmark_expected_return, benchmark_instrument_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  settings: { benchmarkExpectedReturn: number | null; benchmarkInstrumentId: string | null }
) {
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      benchmark_expected_return: settings.benchmarkExpectedReturn,
      benchmark_instrument_id: settings.benchmarkInstrumentId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function getDecisionSheet(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string
): Promise<Pick<SheetRow, "thesis_why" | "thesis_wrong" | "scenarios"> | null> {
  const { data, error } = await supabase
    .from("decision_sheets")
    .select("thesis_why, thesis_wrong, scenarios")
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDecisionSheet(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string,
  sheet: { thesisWhy: string; thesisWrong: string; scenarios: Record<string, unknown> }
) {
  const { error } = await supabase.from("decision_sheets").upsert(
    {
      user_id: userId,
      instrument_id: instrumentId,
      thesis_why: sheet.thesisWhy,
      thesis_wrong: sheet.thesisWrong,
      scenarios: sheet.scenarios,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,instrument_id" }
  );
  if (error) throw error;
}

export type DecisionRecordWithInstrument = RecordRow & {
  instruments: { name: string; provider_symbol: string; display_symbol: string } | null;
};

export async function listDecisionRecords(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DecisionRecordWithInstrument[]> {
  const { data, error } = await supabase
    .from("decision_records")
    .select("*, instruments(name, provider_symbol, display_symbol)")
    .eq("user_id", userId)
    .order("decided_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DecisionRecordWithInstrument[];
}

/** 判断の記録は不変（更新ポリシー無し）。追加のみ。 */
export async function insertDecisionRecord(supabase: SupabaseClient<Database>, record: RecordInsert) {
  const { data, error } = await supabase.from("decision_records").insert(record).select("id").single();
  if (error) throw error;
  return data;
}

export async function deleteDecisionRecord(supabase: SupabaseClient<Database>, userId: string, id: string) {
  const { error } = await supabase.from("decision_records").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
