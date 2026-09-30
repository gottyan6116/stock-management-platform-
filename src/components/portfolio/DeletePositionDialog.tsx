"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { POSITIONS_KEY } from "@/features/portfolio/api";
import type { EvaluatedPosition } from "@/features/portfolio/types";

async function deletePosition(positionId: string) {
  const res = await fetch(`/api/positions/${encodeURIComponent(positionId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete position failed: ${res.status}`);
}

/** 削除の確認ダイアログ。誤操作を防ぐため、一覧のボタンから直接は削除しない。 */
export function DeletePositionDialog({
  position,
  onClose,
}: {
  position: EvaluatedPosition | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => deletePosition(position!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
      setError(null);
      onClose();
    },
    onError: () => setError("削除に失敗しました。時間をおいて再度お試しください。"),
  });

  return (
    <Modal open={position !== null} onClose={onClose} title="保有を削除しますか？">
      <p className="text-sm text-text-secondary">
        {position?.name}（{position?.quantity.toLocaleString("ja-JP")}
        {position?.assetClass === "fund" ? "口" : "株"}）の保有を削除します。この操作は元に戻せません。
      </p>
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
          className="min-h-11 rounded-button bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? "削除中..." : "削除する"}
        </button>
      </div>
    </Modal>
  );
}
