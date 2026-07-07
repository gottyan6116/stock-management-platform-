import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type SimulationAccountRow = Database["public"]["Tables"]["simulation_accounts"]["Row"];
type InstrumentRow = Database["public"]["Tables"]["instruments"]["Row"];

export interface SimulationHoldingWithInstrument {
  id: string;
  quantity: number;
  avgCost: number;
  instrument: InstrumentRow;
}

export interface SimulationTradeWithInstrument {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  currency: "JPY" | "USD";
  realizedPnl: number | null;
  executedAt: string;
  instrument: InstrumentRow;
}

export async function getOrCreateSimulationAccount(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SimulationAccountRow> {
  const { data: existing, error: findError } = await supabase
    .from("simulation_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("simulation_accounts")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSimulationHoldings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SimulationHoldingWithInstrument[]> {
  const { data, error } = await supabase
    .from("simulation_holdings")
    .select("id, quantity, avg_cost, instrument_id, instruments(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      quantity: row.quantity,
      avgCost: row.avg_cost,
      instrument: row.instruments,
    }));
}

export async function listSimulationTrades(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20
): Promise<SimulationTradeWithInstrument[]> {
  const { data, error } = await supabase
    .from("simulation_trades")
    .select("id, side, quantity, price, currency, realized_pnl, executed_at, instrument_id, instruments(*)")
    .eq("user_id", userId)
    .order("executed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { instruments: InstrumentRow } => row.instruments !== null)
    .map((row) => ({
      id: row.id,
      side: row.side,
      quantity: row.quantity,
      price: row.price,
      currency: row.currency,
      realizedPnl: row.realized_pnl,
      executedAt: row.executed_at,
      instrument: row.instruments,
    }));
}

/**
 * 売買を実行する（複数テーブルへの逐次更新。個人利用のペーパートレードのため
 * Postgresトランザクション関数までは導入せず、アプリ層での整合性チェックに留める）。
 */
export async function executeSimulationTrade(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrument: InstrumentRow,
  side: "buy" | "sell",
  quantity: number,
  price: number
): Promise<void> {
  const currency = instrument.currency;
  const cashField = currency === "JPY" ? "cash_balance_jpy" : "cash_balance_usd";
  const account = await getOrCreateSimulationAccount(supabase, userId);
  const cost = quantity * price;

  const { data: existingHolding, error: holdingError } = await supabase
    .from("simulation_holdings")
    .select("*")
    .eq("user_id", userId)
    .eq("instrument_id", instrument.id)
    .maybeSingle();
  if (holdingError) throw holdingError;

  if (side === "buy") {
    if (account[cashField] < cost) {
      throw new Error("現金残高が不足しています。");
    }

    const newQuantity = (existingHolding?.quantity ?? 0) + quantity;
    const newAvgCost = existingHolding
      ? (existingHolding.quantity * existingHolding.avg_cost + cost) / newQuantity
      : price;

    const { error: upsertError } = await supabase.from("simulation_holdings").upsert(
      { user_id: userId, instrument_id: instrument.id, quantity: newQuantity, avg_cost: newAvgCost },
      { onConflict: "user_id,instrument_id" }
    );
    if (upsertError) throw upsertError;

    const accountUpdate =
      cashField === "cash_balance_jpy"
        ? { cash_balance_jpy: account.cash_balance_jpy - cost }
        : { cash_balance_usd: account.cash_balance_usd - cost };
    const { error: accountError } = await supabase
      .from("simulation_accounts")
      .update(accountUpdate)
      .eq("user_id", userId);
    if (accountError) throw accountError;

    const { error: tradeError } = await supabase.from("simulation_trades").insert({
      user_id: userId,
      instrument_id: instrument.id,
      side: "buy",
      quantity,
      price,
      currency,
      realized_pnl: null,
    });
    if (tradeError) throw tradeError;
    return;
  }

  if (!existingHolding || existingHolding.quantity < quantity) {
    throw new Error("保有数量が不足しています。");
  }

  const realizedPnl = (price - existingHolding.avg_cost) * quantity;
  const remainingQty = existingHolding.quantity - quantity;

  if (remainingQty > 0) {
    const { error: updateError } = await supabase
      .from("simulation_holdings")
      .update({ quantity: remainingQty })
      .eq("id", existingHolding.id);
    if (updateError) throw updateError;
  } else {
    const { error: deleteError } = await supabase
      .from("simulation_holdings")
      .delete()
      .eq("id", existingHolding.id);
    if (deleteError) throw deleteError;
  }

  const accountUpdate =
    cashField === "cash_balance_jpy"
      ? { cash_balance_jpy: account.cash_balance_jpy + cost }
      : { cash_balance_usd: account.cash_balance_usd + cost };
  const { error: accountError } = await supabase
    .from("simulation_accounts")
    .update(accountUpdate)
    .eq("user_id", userId);
  if (accountError) throw accountError;

  const { error: tradeError } = await supabase.from("simulation_trades").insert({
    user_id: userId,
    instrument_id: instrument.id,
    side: "sell",
    quantity,
    price,
    currency,
    realized_pnl: realizedPnl,
  });
  if (tradeError) throw tradeError;
}

export async function resetSimulation(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  await supabase.from("simulation_holdings").delete().eq("user_id", userId);
  await supabase.from("simulation_trades").delete().eq("user_id", userId);
  const account = await getOrCreateSimulationAccount(supabase, userId);
  await supabase
    .from("simulation_accounts")
    .update({
      cash_balance_jpy: account.initial_balance_jpy,
      cash_balance_usd: account.initial_balance_usd,
    })
    .eq("user_id", userId);
}
