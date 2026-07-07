import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateSimulationAccount,
  listSimulationHoldings,
  listSimulationTrades,
} from "@/server/repositories/simulation-repository";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { apiError } from "@/lib/errors/api-error";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  try {
    const [account, holdings, trades] = await Promise.all([
      getOrCreateSimulationAccount(supabase, user.id),
      listSimulationHoldings(supabase, user.id),
      listSimulationTrades(supabase, user.id),
    ]);

    const provider = getMarketDataProvider();
    const evaluatedHoldings = await Promise.all(
      holdings.map(async (h) => {
        const quote = await provider.getQuote(h.instrument.provider_symbol).catch(() => null);
        return {
          id: h.id,
          quantity: h.quantity,
          avgCost: h.avgCost,
          providerSymbol: h.instrument.provider_symbol,
          displaySymbol: h.instrument.display_symbol,
          name: h.instrument.name,
          market: h.instrument.market,
          currency: h.instrument.currency,
          lastClose: quote?.close ?? null,
          change: quote?.change ?? null,
          changePercent: quote?.changePercent ?? null,
        };
      })
    );

    return NextResponse.json({
      data: {
        account: {
          cashJpy: account.cash_balance_jpy,
          cashUsd: account.cash_balance_usd,
          initialJpy: account.initial_balance_jpy,
          initialUsd: account.initial_balance_usd,
        },
        holdings: evaluatedHoldings,
        trades: trades.map((t) => ({
          id: t.id,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          currency: t.currency,
          realizedPnl: t.realizedPnl,
          executedAt: t.executedAt,
          providerSymbol: t.instrument.provider_symbol,
          name: t.instrument.name,
        })),
      },
    });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
