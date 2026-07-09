"use client";

import { useMemo, useState } from "react";
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
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type NisaType = "tsumitate" | "growth" | null;
type Tab = "all" | "tsumitate" | "growth" | "US" | "JP";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "tsumitate", label: "積立NISA" },
  { value: "growth", label: "成長投資枠" },
  { value: "US", label: "米国株" },
  { value: "JP", label: "日本株" },
];

const NISA_LABEL: Record<Exclude<NisaType, null>, string> = {
  tsumitate: "積立NISA",
  growth: "成長投資枠",
};

interface PositionApiItem {
  id: string;
  quantity: number;
  avgCost: number | null;
  nisaType: NisaType;
  isManual: boolean;
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

interface AddPositionInput {
  providerSymbol?: string;
  manualName?: string;
  manualUnitPrice?: string;
  quantity: number;
  avgCost: string;
  nisaType: NisaType;
}

async function addPosition(input: AddPositionInput) {
  const res = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerSymbol: input.providerSymbol,
      manualName: input.manualName,
      manualUnitPrice: input.manualUnitPrice === "" ? undefined : Number(input.manualUnitPrice),
      quantity: input.quantity,
      avgCost: input.avgCost === "" ? undefined : Number(input.avgCost),
      nisaType: input.nisaType ?? undefined,
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
  const positions = useMemo(() => data ?? [], [data]);

  const [tab, setTab] = useState<Tab>("all");
  const [isManualMode, setIsManualMode] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [nisaType, setNisaType] = useState<NisaType>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: addPosition,
    onSuccess: () => {
      setSymbol("");
      setManualName("");
      setManualUnitPrice("");
      setQuantity("");
      setAvgCost("");
      setNisaType(null);
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
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setFormError("保有数量（正の数）を入力してください。");
      return;
    }
    if (isManualMode) {
      if (!manualName.trim() || manualUnitPrice === "") {
        setFormError("ファンド名と基準価額を入力してください。");
        return;
      }
      addMutation.mutate({
        manualName: manualName.trim(),
        manualUnitPrice,
        quantity: quantityNum,
        avgCost,
        nisaType,
      });
    } else {
      if (!symbol.trim()) {
        setFormError("銘柄コードを入力してください。");
        return;
      }
      addMutation.mutate({ providerSymbol: symbol.trim(), quantity: quantityNum, avgCost, nisaType });
    }
  }

  const evaluated = useMemo(
    () =>
      positions.map((p) => {
        const marketValue = p.lastClose !== null ? p.lastClose * p.quantity : null;
        const costBasis = p.avgCost !== null ? p.avgCost * p.quantity : null;
        const unrealizedPnl = marketValue !== null && costBasis !== null ? marketValue - costBasis : null;
        return { ...p, marketValue, costBasis, unrealizedPnl };
      }),
    [positions]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return evaluated;
    if (tab === "tsumitate" || tab === "growth") return evaluated.filter((p) => p.nisaType === tab);
    return evaluated.filter((p) => p.market === tab);
  }, [evaluated, tab]);

  const totalMarketValueByCurrency = filtered.reduce<Record<string, number>>((acc, p) => {
    if (p.marketValue === null) return acc;
    acc[p.currency] = (acc[p.currency] ?? 0) + p.marketValue;
    return acc;
  }, {});

  const totalPnlByCurrency = filtered.reduce<Record<string, number>>((acc, p) => {
    if (p.unrealizedPnl === null) return acc;
    acc[p.currency] = (acc[p.currency] ?? 0) + p.unrealizedPnl;
    return acc;
  }, {});

  const totalCostBasisByCurrency = filtered.reduce<Record<string, number>>((acc, p) => {
    if (p.costBasis === null) return acc;
    acc[p.currency] = (acc[p.currency] ?? 0) + p.costBasis;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="ポートフォリオの表示切替" className="inline-flex flex-wrap gap-1 rounded-button border border-border bg-surface-subtle p-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === t.value ? "bg-surface text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:gap-4">
        <MetricCard label="保有銘柄数">
          <MetricValue>{filtered.length}銘柄</MetricValue>
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
          {Object.entries(totalPnlByCurrency).length === 0 ? (
            <MetricValue>—</MetricValue>
          ) : (
            <div className="flex flex-col gap-0.5">
              {Object.entries(totalPnlByCurrency).map(([currency, value]) => {
                const costBasis = totalCostBasisByCurrency[currency] ?? 0;
                const percent = costBasis !== 0 ? (value / costBasis) * 100 : null;
                const isUp = value > 0;
                const isDown = value < 0;
                const colorClass = isUp ? "text-success" : isDown ? "text-danger" : "text-text-primary";
                return (
                  <p key={currency} className={cn("text-lg font-bold tabular-nums 2xl:text-[26px]", colorClass)}>
                    {value > 0 ? "+" : ""}
                    {formatCurrency(value, currency as Currency)}
                    {percent !== null ? (
                      <span className="ml-1 text-sm font-semibold 2xl:text-base">({formatPercent(percent)})</span>
                    ) : null}
                  </p>
                );
              })}
            </div>
          )}
        </MetricCard>
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-text-primary">保有銘柄を追加</p>
          <div role="group" aria-label="登録方法切替" className="inline-flex rounded-button border border-border p-0.5">
            <button
              type="button"
              onClick={() => setIsManualMode(false)}
              className={cn(
                "rounded-sm px-3 py-1 text-xs font-semibold",
                !isManualMode ? "bg-primary-soft text-primary" : "text-text-secondary"
              )}
            >
              株式・ETF
            </button>
            <button
              type="button"
              onClick={() => setIsManualMode(true)}
              className={cn(
                "rounded-sm px-3 py-1 text-xs font-semibold",
                isManualMode ? "bg-primary-soft text-primary" : "text-text-secondary"
              )}
            >
              投資信託（手入力）
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            {isManualMode ? (
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="position-fund-name" className="text-xs font-semibold text-text-secondary">
                  ファンド名
                </label>
                <input
                  id="position-fund-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="eMAXIS Slim 全世界株式(オール・カントリー)"
                  className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="position-symbol" className="text-xs font-semibold text-text-secondary">
                  銘柄コードまたは銘柄名（例: 7203.T, AAPL, トヨタ）
                </label>
                <SymbolCombobox id="position-symbol" value={symbol} onChange={setSymbol} placeholder="AAPL" />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="position-nisa" className="text-xs font-semibold text-text-secondary">
                NISA区分（任意）
              </label>
              <select
                id="position-nisa"
                value={nisaType ?? ""}
                onChange={(e) => setNisaType((e.target.value || null) as NisaType)}
                className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
              >
                <option value="">なし（課税口座）</option>
                <option value="tsumitate">積立NISA</option>
                <option value="growth">成長投資枠</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="position-quantity" className="text-xs font-semibold text-text-secondary">
                保有数量{isManualMode ? "（口）" : ""}
              </label>
              <input
                id="position-quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isManualMode ? "53950" : "10"}
                className="w-36 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="position-cost" className="text-xs font-semibold text-text-secondary">
                平均取得価額{isManualMode ? "（1万口あたり・任意）" : "（任意）"}
              </label>
              <input
                id="position-cost"
                type="number"
                min="0"
                step="any"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder={isManualMode ? "44022.24" : "150.00"}
                className="w-40 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
              />
            </div>
            {isManualMode ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="position-unit-price" className="text-xs font-semibold text-text-secondary">
                  基準価額（1万口あたり）
                </label>
                <input
                  id="position-unit-price"
                  type="number"
                  min="0"
                  step="any"
                  value={manualUnitPrice}
                  onChange={(e) => setManualUnitPrice(e.target.value)}
                  placeholder="60489"
                  className="w-40 rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
                />
              </div>
            ) : null}
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {addMutation.isPending ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
        {formError ? <p className="mt-2 text-xs text-danger">{formError}</p> : null}
        <p className="mt-2 text-xs text-text-muted">
          手入力による記録です。証券口座とは連携していません（概算値）。投資信託はYahoo
          Financeにシンボルが無いため、基準価額を手入力で更新してください。
        </p>
      </div>

      {isLoading ? null : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="保有銘柄がまだ登録されていません"
          description="上のフォームから銘柄コード・保有数量を入力して追加してください"
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
                  市場 / 区分
                </th>
                <th scope="col" className="px-4 py-3">
                  保有数量
                </th>
                <th scope="col" className="px-4 py-3">
                  最新終値/基準価額
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
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    router.push(`/stocks/${encodeURIComponent(p.providerSymbol)}`);
                  }}
                  className={cn(
                    "border-t border-border",
                    "cursor-pointer hover:bg-surface-subtle"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-muted">
                      {p.isManual ? "投資信託（手入力）" : `${p.displaySymbol} · ${p.exchange ?? "—"}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <MarketBadge market={p.market} />
                      {p.nisaType ? (
                        <span className="text-[11px] font-semibold text-primary">{NISA_LABEL[p.nisaType]}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.quantity.toLocaleString()}
                    {p.instrumentType === "fund" ? "口" : "株"}
                  </td>
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

        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                router.push(`/stocks/${encodeURIComponent(p.providerSymbol)}`);
              }}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col gap-2 rounded-card border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{p.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {p.isManual ? "投資信託（手入力）" : `${p.displaySymbol} · ${p.exchange ?? "—"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMutation.mutate(p.id);
                  }}
                  aria-label="削除"
                  className="shrink-0 rounded-sm p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <MarketBadge market={p.market} />
                {p.nisaType ? (
                  <span className="text-[11px] font-semibold text-primary">{NISA_LABEL[p.nisaType]}</span>
                ) : null}
                <span className="text-xs text-text-muted">
                  {p.quantity.toLocaleString()}
                  {p.instrumentType === "fund" ? "口" : "株"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[11px] text-text-muted">最新終値/基準価額</p>
                  <CurrencyValue value={p.lastClose} currency={p.currency} />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">前営業日比</p>
                  <PercentChange amount={p.change} percent={p.changePercent} />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">評価額</p>
                  <CurrencyValue value={p.marketValue} currency={p.currency} />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">評価損益</p>
                  {p.unrealizedPnl === null ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <PercentChange
                      amount={p.unrealizedPnl}
                      percent={p.costBasis && p.costBasis !== 0 ? (p.unrealizedPnl / p.costBasis) * 100 : null}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
