"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { POSITIONS_KEY } from "@/features/portfolio/api";
import type { EvaluatedPosition, NisaType } from "@/features/portfolio/types";

async function patchPosition(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/positions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `update failed: ${res.status}`);
  }
}

// 取得単価は displayPrice と同じ単位（株=1株あたり、投信=1万口あたり）で入力・保存する。
// API の avgCost は 1単位あたり（投信は ÷10,000 済み）なので、投信は 1万口あたりへ戻して表示する。
function toInputCost(position: EvaluatedPosition): string {
  if (position.avgCost === null) return "";
  const perDisplayUnit = position.assetClass === "fund" ? position.avgCost * position.unitDivisor : position.avgCost;
  return String(Math.round(perDisplayUnit * 100) / 100);
}

export function EditPositionDialog({
  position,
  onClose,
}: {
  position: EvaluatedPosition | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [nisaType, setNisaType] = useState<NisaType>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    setQuantity(String(position.quantity));
    setAvgCost(toInputCost(position));
    setNisaType(position.nisaType);
    setError(null);
  }, [position]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchPosition(position!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      setError("数量は正の数で入力してください。");
      return;
    }
    const cost = avgCost.trim() === "" ? null : Number(avgCost);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("取得単価は0以上の数で入力してください。");
      return;
    }
    mutation.mutate({ quantity: q, avgCost: cost, nisaType });
  }

  const isFund = position?.assetClass === "fund";
  const fieldClass =
    "min-h-11 w-full rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus";

  return (
    <Modal open={position !== null} onClose={onClose} title={position ? `${position.name} を編集` : "編集"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-quantity" className="text-xs font-semibold text-text-secondary">
            数量{isFund ? "（口）" : "（株）"}
          </label>
          <input
            id="edit-quantity"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-cost" className="text-xs font-semibold text-text-secondary">
            平均取得単価{isFund ? "（1万口あたり）" : ""}
          </label>
          <input
            id="edit-cost"
            type="number"
            min="0"
            step="any"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="未入力なら損益は計算されません"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-account" className="text-xs font-semibold text-text-secondary">
            口座
          </label>
          <select
            id="edit-account"
            value={nisaType ?? ""}
            onChange={(e) => setNisaType((e.target.value || null) as NisaType)}
            className={fieldClass}
          >
            <option value="">課税口座</option>
            <option value="growth">成長投資枠</option>
            <option value="tsumitate">つみたて投資枠</option>
          </select>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {mutation.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
