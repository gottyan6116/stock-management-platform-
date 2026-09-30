"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { SymbolCombobox } from "@/components/search/SymbolCombobox";
import { FundNameCombobox } from "@/components/search/FundNameCombobox";
import { POSITIONS_KEY } from "@/features/portfolio/api";
import type { NisaType } from "@/features/portfolio/types";
import { cn } from "@/lib/utils/cn";

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

const fieldClass =
  "min-h-11 rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus";

/** 「＋保有を追加」から開く追加ダイアログ（株式・ETF／投資信託の手入力）。 */
export function AddPositionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
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
      onClose();
    },
    onError: (error: Error) => setFormError(error.message),
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
      addMutation.mutate({ manualName: manualName.trim(), manualUnitPrice, quantity: quantityNum, avgCost, nisaType });
    } else {
      if (!symbol.trim()) {
        setFormError("銘柄コードを入力してください。");
        return;
      }
      addMutation.mutate({ providerSymbol: symbol.trim(), quantity: quantityNum, avgCost, nisaType });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="保有を追加">
      <div className="mb-3 flex justify-end">
        <div role="group" aria-label="登録方法切替" className="inline-flex rounded-button border border-border p-0.5">
          <button
            type="button"
            onClick={() => setIsManualMode(false)}
            className={cn(
              "min-h-9 rounded-sm px-3 text-xs font-semibold",
              !isManualMode ? "bg-primary-soft text-primary" : "text-text-secondary"
            )}
          >
            株式・ETF
          </button>
          <button
            type="button"
            onClick={() => setIsManualMode(true)}
            className={cn(
              "min-h-9 rounded-sm px-3 text-xs font-semibold",
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
              <FundNameCombobox
                id="position-fund-name"
                value={manualName}
                onChange={setManualName}
                placeholder="eMAXIS Slim 全世界株式(オール・カントリー)"
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
              口座（任意）
            </label>
            <select
              id="position-nisa"
              value={nisaType ?? ""}
              onChange={(e) => setNisaType((e.target.value || null) as NisaType)}
              className={fieldClass}
            >
              <option value="">課税口座</option>
              <option value="tsumitate">つみたて投資枠</option>
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
              className={cn(fieldClass, "w-36")}
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
              className={cn(fieldClass, "w-40")}
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
                className={cn(fieldClass, "w-40")}
              />
            </div>
          ) : null}
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {addMutation.isPending ? "追加中..." : "追加"}
          </button>
        </div>
      </form>
      {formError ? (
        <p role="alert" className="mt-2 text-xs text-danger-text">
          {formError}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-text-muted">
        手入力による記録です。証券口座とは連携していません（概算値）。投資信託はYahoo Financeにシンボルが無いため、基準価額を手入力で更新してください。
      </p>
    </Modal>
  );
}
