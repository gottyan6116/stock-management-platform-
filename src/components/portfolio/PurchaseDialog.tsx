"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { purchasesKey, type PurchaseItem } from "@/features/portfolio/purchases";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import { formatCurrency, todayJst } from "@/lib/utils/format";

const ACCOUNT_NAME = { tsumitate: "つみたて投資枠", growth: "成長投資枠" } as const;
type NisaAccount = keyof typeof ACCOUNT_NAME;

async function postPurchase(body: Record<string, unknown>) {
  const res = await fetch("/api/purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "記録に失敗しました。時間をおいて再度お試しください。");
  }
}

async function removePurchase(id: string) {
  const res = await fetch(`/api/purchases/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("削除に失敗しました。");
}

const fieldClass =
  "min-h-11 w-full rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus";

/** NISAの買付（年間投資枠の消化額）を記録する。金額のみ必須。口数は分かるときだけ。 */
export function PurchaseDialog({
  open,
  onClose,
  year,
  positions,
  purchases,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  positions: readonly EvaluatedPosition[];
  purchases: readonly PurchaseItem[];
}) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<NisaAccount>("tsumitate");
  const [instrumentId, setInstrumentId] = useState("");
  const [tradedOn, setTradedOn] = useState(todayJst());
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // その口座で保有している銘柄だけを選択肢にする。
  const choices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of positions) if (p.nisaType === account) seen.set(p.instrumentId, p.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [positions, account]);
  const selectedId = choices.some((c) => c.id === instrumentId) ? instrumentId : (choices[0]?.id ?? "");

  const refresh = () => queryClient.invalidateQueries({ queryKey: purchasesKey(year) });

  const add = useMutation({
    mutationFn: postPurchase,
    onSuccess: () => {
      setAmount("");
      setError(null);
      void refresh();
    },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: removePurchase,
    onSuccess: () => void refresh(),
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amountJpy = Number(amount);
    if (!selectedId) {
      setError("この口座に保有銘柄がありません。先に保有を登録してください。");
      return;
    }
    if (!Number.isFinite(amountJpy) || amountJpy <= 0) {
      setError("金額（円）は正の数で入力してください。");
      return;
    }
    add.mutate({ instrumentId: selectedId, nisaType: account, tradedOn, amountJpy });
  }

  return (
    <Modal open={open} onClose={onClose} title={`${year}年のNISA買付を記録`}>
      <p className="text-sm leading-6 text-text-secondary">
        年間投資枠は「その年に買付した金額」で消化されます。約定金額（手数料を除く）を1回ずつ記録してください。
      </p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-account" className="text-xs font-semibold text-text-secondary">
            口座
          </label>
          <select
            id="purchase-account"
            value={account}
            onChange={(e) => setAccount(e.target.value as NisaAccount)}
            className={fieldClass}
          >
            <option value="tsumitate">{ACCOUNT_NAME.tsumitate}</option>
            <option value="growth">{ACCOUNT_NAME.growth}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-instrument" className="text-xs font-semibold text-text-secondary">
            銘柄
          </label>
          <select
            id="purchase-instrument"
            value={selectedId}
            onChange={(e) => setInstrumentId(e.target.value)}
            className={fieldClass}
          >
            {choices.length === 0 ? <option value="">保有銘柄なし</option> : null}
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-date" className="text-xs font-semibold text-text-secondary">
            約定日
          </label>
          <input
            id="purchase-date"
            type="date"
            value={tradedOn}
            max={todayJst()}
            onChange={(e) => setTradedOn(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="purchase-amount" className="text-xs font-semibold text-text-secondary">
            金額（円）
          </label>
          <input
            id="purchase-amount"
            type="number"
            min="0"
            step="any"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger-text sm:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end sm:col-span-2">
          <button
            type="submit"
            disabled={add.isPending}
            className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {add.isPending ? "記録中..." : "この買付を記録"}
          </button>
        </div>
      </form>

      <h3 className="mt-5 text-sm font-bold text-text-primary">記録済み（{year}年）</h3>
      {purchases.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">まだありません。</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-card border border-border">
          {purchases.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-text-primary">{p.name}</span>
                <span className="text-xs text-text-muted">
                  {p.tradedOn}・{p.nisaType ? ACCOUNT_NAME[p.nisaType] : "課税口座"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular-nums font-semibold">{formatCurrency(p.amountJpy, "JPY")}</span>
                <button
                  type="button"
                  aria-label={`${p.tradedOn}の${p.name}の記録を削除`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(p.id)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
