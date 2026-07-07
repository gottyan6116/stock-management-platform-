"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Currency, Market } from "@/types/domain";
import { MetricCard, MetricValue } from "@/components/ui/MetricCard";
import { MarketBadge } from "@/components/tables/MarketBadge";
import { PercentChange } from "@/components/tables/PercentChange";
import { CurrencyValue } from "@/components/tables/CurrencyValue";
import { EmptyState } from "@/components/feedback/EmptyState";
import { SymbolCombobox } from "@/components/search/SymbolCombobox";
import { formatCurrency } from "@/lib/utils/format";

interface PositionApiItem {
  id: string;
  quantity: number;
  avgCost: number | null;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: string;
  priceDate: string | null;
  lastClose: number | null;
  change: number | null;
  changePercent: number | null;
}

async function fetchPositions(): Promise<PositionApiItem[]> {
  const res = await fetch("/api/positions");
  if (!res.ok) throw new Error(`positions request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function addPosition(input: { providerSymbol: string; quantity: number; avgCost: string }) {
  const res = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerSymbol: input.providerSymbol,
      quantity: input.quantity,
      avgCost: input.avgCost === "" ? undefined : Number(input.avgCost),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `add position failed: ${res.status}`);
  }
}

async function deletePosition(positionId: string) {
  const res = await fetch(`/api/positions/${encodeURIComponent(positionId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete position failed: ${res.status}`);
}

const POSITIONS_KEY = ["positions"] as const;

export function PortfolioDashboard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: POSITIONS_KEY, queryFn: fetchPositions });
  const positions = data ?? [];

  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: addPosition,
    onSuccess: () => {
      setSymbol("");
      setQuantity("");
      setAvgCost("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: POSITIONS_KEY }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantityNum = Number(quantity);
    if (!symbol.trim() || !Number.isFinite(quantityNum) || quantityNum <= 0) {
      setFormError("銘柄コードと保有数量（正の数）を入力してください。");
      return;
    }
    addMutation.mutate({ providerSymbol: symbol.trim(), quantity: quantityNum, avgCost });
  }

  const evaluated = positions.map((p) => {
    const marketValue = p.lastClose !== null ? p.lastClose * p.quantity : null;
    const costBasis = p.avgCost !== null ? p.avgCost * p.quantity : null;
    const unrealizedPnl = marketValue !== null && costBasis !== null ? marketValue - costBasis : null;
    return { ...p, marketValue, costBasis, unrealizedPnl };
  });

  const totalMarketValueByCurrency = evaluated.reduce<Record<string, number>>((acc, p) => {
    if (p.marketValue === null) return acc;
    acc[p.currency] = (acc[p.currency] ?? 0) + p.marketValue;
    return acc;
  }, {});

  const totalPnlByCurrency = evaluated.reduce<Record<string, number>>((acc, p) => {
    if (p.unrealizedPnl === null) return acc;
    acc[p.currency] = (acc[p.currency] ?? 0) + p.unrealizedPnl;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:gap-4">
        <MetricCard label="保有銘柄数">
          <MetricValue>{positions.length}銘柄</MetricValue>
        </MetricCard>
        <MetricCard label="評価額合計">
          <MetricValue>
            {Object.entries(totalMarketValueByCurrency).length === 0
              ? "—"
              : Object.entries(totalMarketValueByCurrency)
                  .map(([currency, value]) => formatCurrency(value, currency as Currency))
                  .join(" + ")}
          </MetricValue>
        </MetricCard>
        <MetricCard label="評価損益合計（概算）">
          <MetricValue>
            {Object.entries(totalPnlByCurrency).length === 0
              ? "—"
              : Object.entries(totalPnlByCurrency)
                  .map(([currency, value]) => formatCurrency(value, currency as Currency))
                  .join(" + ")}
          </MetricValue>
        </MetricCard>
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <p className="mb-3 text-lg font-bold text-text-primary">保有銘柄を追加</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="position-symbol" className="text-xs font-semibold text-text-secondary">
              銘柄コードまたは銘柄名（例: 7203.T, AAPL, トヨタ）
            </label>
            <SymbolCombobox id="position-symbol" value={symbol} onChange={setSymbol} placeholder="AAPL" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="position-quantity" className="text-xs font-semibold text-text-secondary">
              保有数量
            </label>
            <input
              id="position-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
              className="w-32 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="position-cost" className="text-xs font-semibold text-text-secondary">
              取得単価（任意）
            </label>
            <input
              id="position-cost"
              type="number"
              min="0"
              step="any"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="150.00"
              className="w-32 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {addMutation.isPending ? "追加中..." : "追加"}
          </button>
        </form>
        {formError ? <p className="mt-2 text-xs text-danger">{formError}</p> : null}
        <p className="mt-2 text-xs text-text-muted">
          手入力による記録です。証券口座とは連携していません（概算値）。
        </p>
      </div>

      {isLoading ? null : positions.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="保有銘柄がまだ登録されていません"
          description="上のフォームから銘柄コード・保有数量を入力して追加してください"
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-text-muted">
                <th scope="col" className="px-4 py-3">
                  銘柄
                </th>
                <th scope="col" className="px-4 py-3">
                  市場
                </th>
                <th scope="col" className="px-4 py-3">
                  保有数量
                </th>
                <th scope="col" className="px-4 py-3">
                  最新終値
                </th>
                <th scope="col" className="px-4 py-3">
                  前営業日比
                </th>
                <th scope="col" className="px-4 py-3">
                  評価額
                </th>
                <th scope="col" className="px-4 py-3">
                  評価損益
                </th>
                <th scope="col" className="px-4 py-3">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluated.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/stocks/${encodeURIComponent(p.providerSymbol)}`)}
                  className="cursor-pointer border-t border-border hover:bg-surface-subtle"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-muted">
                      {p.displaySymbol} · {p.exchange ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <MarketBadge market={p.market} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.quantity}</td>
                  <td className="px-4 py-3">
                    <CurrencyValue value={p.lastClose} currency={p.currency} />
                  </td>
                  <td className="px-4 py-3">
                    <PercentChange amount={p.change} percent={p.changePercent} />
                  </td>
                  <td className="px-4 py-3">
                    <CurrencyValue value={p.marketValue} currency={p.currency} />
                  </td>
                  <td className="px-4 py-3">
                    {p.unrealizedPnl === null ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <PercentChange
                        amount={p.unrealizedPnl}
                        percent={p.costBasis && p.costBasis !== 0 ? (p.unrealizedPnl / p.costBasis) * 100 : null}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(p.id)}
                      aria-label="削除"
                      className="rounded-sm p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
