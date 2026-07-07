"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import type { Currency, Market } from "@/types/domain";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { PercentChange } from "@/components/tables/PercentChange";
import { EmptyState } from "@/components/feedback/EmptyState";
import { SymbolCombobox } from "@/components/search/SymbolCombobox";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SimulationHoldingItem {
  id: string;
  quantity: number;
  avgCost: number;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  market: Market;
  currency: Currency;
  lastClose: number | null;
  change: number | null;
  changePercent: number | null;
}

interface SimulationTradeItem {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  currency: Currency;
  realizedPnl: number | null;
  executedAt: string;
  providerSymbol: string;
  name: string;
}

interface SimulationData {
  account: { cashJpy: number; cashUsd: number; initialJpy: number; initialUsd: number };
  holdings: SimulationHoldingItem[];
  trades: SimulationTradeItem[];
}

async function fetchSimulation(): Promise<SimulationData> {
  const res = await fetch("/api/simulation");
  if (!res.ok) throw new Error(`simulation request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function executeTrade(input: { providerSymbol: string; side: "buy" | "sell"; quantity: number }) {
  const res = await fetch("/api/simulation/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `trade failed: ${res.status}`);
  }
  const json = await res.json();
  return json.data as { executedPrice: number };
}

async function resetSimulation() {
  const res = await fetch("/api/simulation/reset", { method: "POST" });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

const SIMULATION_KEY = ["simulation"] as const;

export function SimulationDashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: SIMULATION_KEY, queryFn: fetchSimulation });

  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess: (result, variables) => {
      setFormError(null);
      setLastResult(
        `${variables.side === "buy" ? "購入" : "売却"}を実行しました（約定価格: ${result.executedPrice}）`
      );
      setQuantity("");
      queryClient.invalidateQueries({ queryKey: SIMULATION_KEY });
    },
    onError: (error: Error) => {
      setLastResult(null);
      setFormError(error.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetSimulation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIMULATION_KEY }),
  });

  function handleTrade(side: "buy" | "sell") {
    const quantityNum = Number(quantity);
    if (!symbol.trim() || !Number.isFinite(quantityNum) || quantityNum <= 0) {
      setFormError("銘柄と数量（正の数）を入力してください。");
      return;
    }
    tradeMutation.mutate({ providerSymbol: symbol.trim(), side, quantity: quantityNum });
  }

  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const account = data?.account;

  const holdingsValueByCurrency = useMemo(
    () =>
      holdings.reduce<Record<string, number>>((acc, h) => {
        if (h.lastClose === null) return acc;
        acc[h.currency] = (acc[h.currency] ?? 0) + h.lastClose * h.quantity;
        return acc;
      }, {}),
    [holdings]
  );

  const totalAssetsJpy = (account?.cashJpy ?? 0) + (holdingsValueByCurrency.JPY ?? 0);
  const totalAssetsUsd = (account?.cashUsd ?? 0) + (holdingsValueByCurrency.USD ?? 0);
  const pnlJpy = account ? totalAssetsJpy - account.initialJpy : 0;
  const pnlUsd = account ? totalAssetsUsd - account.initialUsd : 0;

  function handleReset() {
    if (window.confirm("シミュレーションをリセットしますか？保有・取引履歴はすべて削除されます。")) {
      resetMutation.mutate();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:gap-4">
        <MetricCard label="現金残高">
          <div className="flex flex-col gap-0.5">
            <MetricValue>{formatCurrency(account?.cashJpy ?? null, "JPY")}</MetricValue>
            <p className="text-sm font-semibold text-text-secondary">
              {formatCurrency(account?.cashUsd ?? null, "USD")}
            </p>
          </div>
        </MetricCard>
        <MetricCard label="保有評価額（概算）">
          <div className="flex flex-col gap-0.5">
            <MetricValue>{formatCurrency(holdingsValueByCurrency.JPY ?? 0, "JPY")}</MetricValue>
            <p className="text-sm font-semibold text-text-secondary">
              {formatCurrency(holdingsValueByCurrency.USD ?? 0, "USD")}
            </p>
          </div>
        </MetricCard>
        <MetricCard label="損益（初期資産比・概算）">
          <div className="flex flex-col gap-0.5">
            {[
              { currency: "JPY" as const, value: pnlJpy, initial: account?.initialJpy ?? 1 },
              { currency: "USD" as const, value: pnlUsd, initial: account?.initialUsd ?? 1 },
            ].map(({ currency, value, initial }) => {
              const isUp = value > 0;
              const isDown = value < 0;
              const colorClass = isUp ? "text-success" : isDown ? "text-danger" : "text-text-primary";
              const percent = initial !== 0 ? (value / initial) * 100 : null;
              return (
                <p key={currency} className={cn("text-lg font-bold tabular-nums 2xl:text-[26px]", colorClass)}>
                  {value > 0 ? "+" : ""}
                  {formatCurrency(value, currency)}
                  {percent !== null ? (
                    <span className="ml-1 text-sm font-semibold 2xl:text-base">
                      ({percent > 0 ? "+" : ""}
                      {percent.toFixed(2)}%)
                    </span>
                  ) : null}
                </p>
              );
            })}
          </div>
        </MetricCard>
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-text-primary">売買する</p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            シミュレーションをリセット
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="simulation-symbol" className="text-xs font-semibold text-text-secondary">
              銘柄コードまたは銘柄名
            </label>
            <SymbolCombobox id="simulation-symbol" value={symbol} onChange={setSymbol} placeholder="AAPL" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="simulation-quantity" className="text-xs font-semibold text-text-secondary">
              数量
            </label>
            <input
              id="simulation-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
              className="w-32 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTrade("buy")}
              disabled={tradeMutation.isPending}
              className="rounded-button bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              購入
            </button>
            <button
              type="button"
              onClick={() => handleTrade("sell")}
              disabled={tradeMutation.isPending}
              className="rounded-button bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              売却
            </button>
          </div>
        </div>
        {formError ? <p className="mt-2 text-xs text-danger">{formError}</p> : null}
        {lastResult ? <p className="mt-2 text-xs text-success">{lastResult}</p> : null}
        <p className="mt-2 text-xs text-text-muted">
          その時点の市場価格で仮想的に売買します。実際の資金は動きません。
        </p>
      </div>

      {isLoading ? null : holdings.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="保有ポジションがありません"
          description="上のフォームから銘柄を選んで購入してください"
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-text-muted">
                  <th scope="col" className="px-4 py-3">
                    銘柄
                  </th>
                  <th scope="col" className="px-4 py-3">
                    数量
                  </th>
                  <th scope="col" className="px-4 py-3">
                    平均取得価格
                  </th>
                  <th scope="col" className="px-4 py-3">
                    現在値
                  </th>
                  <th scope="col" className="px-4 py-3">
                    前営業日比
                  </th>
                  <th scope="col" className="px-4 py-3">
                    評価損益
                  </th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const marketValue = h.lastClose !== null ? h.lastClose * h.quantity : null;
                  const costBasis = h.avgCost * h.quantity;
                  const unrealizedPnl = marketValue !== null ? marketValue - costBasis : null;
                  return (
                    <tr key={h.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">{h.name}</p>
                        <p className="text-xs text-text-muted">{h.displaySymbol}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{h.quantity.toLocaleString()}株</td>
                      <td className="px-4 py-3">
                        <CurrencyValue value={h.avgCost} currency={h.currency} />
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyValue value={h.lastClose} currency={h.currency} />
                      </td>
                      <td className="px-4 py-3">
                        <PercentChange amount={h.change} percent={h.changePercent} />
                      </td>
                      <td className="px-4 py-3">
                        {unrealizedPnl === null ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <PercentChange
                            amount={unrealizedPnl}
                            percent={costBasis !== 0 ? (unrealizedPnl / costBasis) * 100 : null}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {holdings.map((h) => {
              const marketValue = h.lastClose !== null ? h.lastClose * h.quantity : null;
              const costBasis = h.avgCost * h.quantity;
              const unrealizedPnl = marketValue !== null ? marketValue - costBasis : null;
              return (
                <div key={h.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                  <div>
                    <p className="font-semibold text-text-primary">{h.name}</p>
                    <p className="text-xs text-text-muted">
                      {h.displaySymbol} · {h.quantity.toLocaleString()}株
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-text-muted">平均取得価格</p>
                      <CurrencyValue value={h.avgCost} currency={h.currency} />
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">現在値</p>
                      <CurrencyValue value={h.lastClose} currency={h.currency} />
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">前営業日比</p>
                      <PercentChange amount={h.change} percent={h.changePercent} />
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted">評価損益</p>
                      {unrealizedPnl === null ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <PercentChange
                          amount={unrealizedPnl}
                          percent={costBasis !== 0 ? (unrealizedPnl / costBasis) * 100 : null}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {data && data.trades.length > 0 ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-3 text-lg font-bold text-text-primary">取引履歴</p>
          <ul className="flex flex-col gap-2 text-sm">
            {data.trades.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-xs font-semibold",
                      t.side === "buy" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                    )}
                  >
                    {t.side === "buy" ? "購入" : "売却"}
                  </span>
                  <span className="font-medium text-text-primary">{t.name}</span>
                </span>
                <span className="text-text-secondary tabular-nums">
                  {t.quantity.toLocaleString()}株 @ {formatCurrency(t.price, t.currency)}
                </span>
                <span className="text-xs text-text-muted">
                  {new Date(t.executedAt).toLocaleString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
