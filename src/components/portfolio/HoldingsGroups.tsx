"use client";

import Link from "next/link";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import { ASSET_CLASS_LABEL, ASSET_CLASS_ORDER } from "@/lib/domain/asset-class";
import {
  ACCOUNT_LABEL,
  accountKeyOf,
  summarizePortfolioJpy,
  toJpy,
  type FxRate,
} from "@/lib/portfolio/valuation";
import { formatCurrency, formatPercent, formatPrice } from "@/lib/utils/format";
import { SignedAmount } from "@/components/ui/SignedAmount";
import { PositionRowMenu } from "./PositionRowMenu";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatShare(share: number | null): string {
  if (share === null) return "—";
  return `${(share * 100).toFixed(share >= 0.1 ? 1 : 2)}%`;
}

function unitOf(p: EvaluatedPosition): string {
  return p.assetClass === "fund" ? "口" : "株";
}

function PriceCell({ p }: { p: EvaluatedPosition }) {
  return (
    <div className="text-right tabular-nums">
      <div>{formatPrice(p.displayPrice, p.currency)}</div>
      {p.assetClass === "fund" ? (
        <div className="text-[11px] text-text-muted">手入力 {shortDate(p.priceDate)}</div>
      ) : p.changePercent !== null ? (
        <div
          className={`text-[11px] ${p.changePercent > 0 ? "text-success-text" : p.changePercent < 0 ? "text-danger-text" : "text-text-muted"}`}
        >
          {p.changePercent > 0 ? "+" : p.changePercent < 0 ? "−" : "±"}
          {formatPercent(Math.abs(p.changePercent), { withSign: false })} 前日比
        </div>
      ) : (
        <div className="text-[11px] text-text-muted">前日比 —</div>
      )}
    </div>
  );
}

function ValueCell({ p, valueJpy }: { p: EvaluatedPosition; valueJpy: number | null }) {
  const yen = valueJpy;
  return (
    <div className="text-right font-semibold tabular-nums">
      <div>{yen === null ? formatCurrency(p.marketValue, p.currency) : formatCurrency(yen, "JPY")}</div>
      {p.currency === "USD" && p.marketValue !== null && yen !== null ? (
        <div className="text-[11px] font-normal text-text-muted">{formatCurrency(p.marketValue, "USD")}</div>
      ) : null}
    </div>
  );
}

export function HoldingsGroups({
  rows,
  fx,
  onEdit,
  onDelete,
}: {
  rows: readonly EvaluatedPosition[];
  fx: FxRate | null;
  onEdit: (position: EvaluatedPosition) => void;
  onDelete: (position: EvaluatedPosition) => void;
}) {
  const total = summarizePortfolioJpy(rows, fx).totalValueJpy;
  const shareOf = (valueJpy: number | null) => (valueJpy !== null && total ? valueJpy / total : null);

  return (
    <div className="flex flex-col gap-4">
      {ASSET_CLASS_ORDER.map((assetClass) => {
        const groupRows = rows.filter((r) => r.assetClass === assetClass);
        if (groupRows.length === 0) return null;
        const sub = summarizePortfolioJpy(groupRows, fx);
        return (
          <section
            key={assetClass}
            aria-label={ASSET_CLASS_LABEL[assetClass]}
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-text-primary">
                {ASSET_CLASS_LABEL[assetClass]}
                <span className="ml-2 text-xs font-normal text-text-muted">{groupRows.length}件</span>
              </h2>
              <p className="flex flex-wrap items-baseline gap-x-4 text-sm tabular-nums">
                <span className="font-bold text-text-primary">{formatCurrency(sub.totalValueJpy, "JPY")}</span>
                <SignedAmount value={sub.unrealizedPnlJpy} currency="JPY" className="font-semibold" />
                <span className="text-text-muted">{formatShare(shareOf(sub.totalValueJpy))}</span>
              </p>
            </header>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-text-muted">
                    <th scope="col" className="px-4 py-2 text-left">銘柄</th>
                    <th scope="col" className="px-4 py-2 text-left">口座</th>
                    <th scope="col" className="px-4 py-2 text-right">数量</th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {assetClass === "fund" ? "基準価額（1万口）" : "株価"}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">評価額（円）</th>
                    <th scope="col" className="px-4 py-2 text-right">含み損益</th>
                    <th scope="col" className="px-4 py-2 text-right">構成比</th>
                    <th scope="col" className="w-12 px-2 py-2">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((p) => {
                    const valueJpy = toJpy(p.marketValue, p.currency, fx);
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="max-w-[280px] px-4 py-3">
                          <Link
                            href={`/stocks/${encodeURIComponent(p.providerSymbol)}`}
                            className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            <span className="block truncate font-semibold text-text-primary hover:text-primary">
                              {p.name}
                            </span>
                            <span className="block truncate text-xs text-text-muted">
                              {p.assetClass === "fund" ? "投資信託" : p.displaySymbol}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{ACCOUNT_LABEL[accountKeyOf(p.nisaType)]}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {p.quantity.toLocaleString("ja-JP")}
                          {unitOf(p)}
                        </td>
                        <td className="px-4 py-3">
                          <PriceCell p={p} />
                        </td>
                        <td className="px-4 py-3">
                          <ValueCell p={p} valueJpy={valueJpy} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <SignedAmount value={p.unrealizedPnl} currency={p.currency} percent={p.unrealizedPnlPercent} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                          {formatShare(shareOf(valueJpy))}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <PositionRowMenu name={p.name} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {groupRows.map((p) => {
                const valueJpy = toJpy(p.marketValue, p.currency, fx);
                return (
                  <li key={p.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/stocks/${encodeURIComponent(p.providerSymbol)}`}
                        className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <span className="block truncate font-semibold text-text-primary">{p.name}</span>
                        <span className="block text-xs text-text-muted">
                          {ACCOUNT_LABEL[accountKeyOf(p.nisaType)]} · {p.quantity.toLocaleString("ja-JP")}
                          {unitOf(p)}
                        </span>
                      </Link>
                      <PositionRowMenu name={p.name} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[11px] text-text-muted">
                          {p.assetClass === "fund" ? "基準価額（1万口）" : "株価"}
                        </p>
                        <PriceCell p={p} />
                      </div>
                      <div>
                        <p className="text-right text-[11px] text-text-muted">評価額（円）</p>
                        <ValueCell p={p} valueJpy={valueJpy} />
                      </div>
                      <div className="col-span-2 flex items-center justify-between border-t border-border pt-2">
                        <span className="text-[11px] text-text-muted">含み損益</span>
                        <SignedAmount value={p.unrealizedPnl} currency={p.currency} percent={p.unrealizedPnlPercent} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
