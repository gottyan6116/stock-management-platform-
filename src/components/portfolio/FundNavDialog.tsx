"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { POSITIONS_KEY } from "@/features/portfolio/api";
import type { EvaluatedPosition } from "@/features/portfolio/types";
import { formatPrice, todayJst } from "@/lib/utils/format";

interface FundRow {
  instrumentId: string;
  name: string;
  priceDate: string | null;
  displayPrice: number | null;
}

/** 同じファンドを複数口座で持っていても1行にまとめる。 */
function uniqueFunds(positions: readonly EvaluatedPosition[]): FundRow[] {
  const byInstrument = new Map<string, FundRow>();
  for (const p of positions) {
    if (p.assetClass !== "fund" || byInstrument.has(p.instrumentId)) continue;
    byInstrument.set(p.instrumentId, {
      instrumentId: p.instrumentId,
      name: p.name,
      priceDate: p.priceDate,
      displayPrice: p.displayPrice,
    });
  }
  return [...byInstrument.values()];
}

async function saveNav(instrumentId: string, priceDate: string, unitPrice: number) {
  const res = await fetch(`/api/funds/${encodeURIComponent(instrumentId)}/prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: [{ priceDate, unitPrice }] }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `nav update failed: ${res.status}`);
  }
}

/**
 * 投資信託の基準価額（1万口あたり）をまとめて更新する。入力した行だけ保存する。
 * 月1回の積立更新を数分で終えられるよう、全ファンドを1画面に並べる。
 */
export function FundNavDialog({
  open,
  onClose,
  positions,
  staleFundIds,
}: {
  open: boolean;
  onClose: () => void;
  positions: readonly EvaluatedPosition[];
  staleFundIds: readonly string[];
}) {
  const queryClient = useQueryClient();
  const funds = uniqueFunds(positions);
  const [priceDate, setPriceDate] = useState(todayJst());
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const entries = funds
        .map((f) => [f, values[f.instrumentId]?.trim() ?? ""] as const)
        .filter(([, v]) => v !== "");
      for (const [fund, raw] of entries) {
        const price = Number(raw);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`「${fund.name}」の基準価額を正の数で入力してください。`);
        }
      }
      if (entries.length === 0) throw new Error("更新する基準価額を1つ以上入力してください。");
      for (const [fund, raw] of entries) await saveNav(fund.instrumentId, priceDate, Number(raw));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
      setValues({});
      setError(null);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="基準価額を更新">
      <p className="mb-3 text-sm text-text-secondary">
        証券会社の画面にある基準価額（1万口あたり）を入力してください。空欄のファンドは更新しません。
      </p>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="nav-date" className="text-xs font-semibold text-text-secondary">
          基準日
        </label>
        <input
          id="nav-date"
          type="date"
          value={priceDate}
          onChange={(e) => setPriceDate(e.target.value)}
          className="min-h-11 rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus"
        />
      </div>
      <ul className="flex flex-col gap-3">
        {funds.map((fund) => {
          const stale = staleFundIds.includes(fund.instrumentId);
          return (
            <li key={fund.instrumentId} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <label htmlFor={`nav-${fund.instrumentId}`} className="min-w-0 flex-1 text-sm text-text-primary">
                <span className="block truncate font-semibold">{fund.name}</span>
                <span className={stale ? "text-xs text-warning-text" : "text-xs text-text-muted"}>
                  現在 {formatPrice(fund.displayPrice, "JPY")}（{fund.priceDate ?? "更新日不明"}）
                  {stale ? " 未更新" : ""}
                </span>
              </label>
              <input
                id={`nav-${fund.instrumentId}`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={values[fund.instrumentId] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [fund.instrumentId]: e.target.value }))}
                placeholder="例: 38532"
                className="min-h-11 w-full rounded-button border border-border px-3 text-right text-sm tabular-nums outline-none focus-visible:border-focus sm:w-40"
              />
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {mutation.isPending ? "保存中..." : "保存"}
        </button>
      </div>
    </Modal>
  );
}
