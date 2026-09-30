"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DECISIONS_KEY, sendJson, useDecisions, type DecisionView } from "@/features/candidates/api";
import { HORIZONS, type Horizon, type OutcomeStatus } from "@/lib/candidates/outcome";
import { formatPrice } from "@/lib/utils/format";

const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
const horizonLabel = (h: Horizon) => `${h}年後`;

function OutcomeCell({ outcome }: { outcome: OutcomeStatus }) {
  if (outcome.status === "pending") {
    return <span className="text-text-muted">{outcome.dueDate} 以降に確認できます</span>;
  }
  if (outcome.status === "unavailable") {
    return <span className="text-text-muted">算出できません（{outcome.reason}）</span>;
  }
  return (
    <span className="tabular-nums">
      <span className="block">
        銘柄 {signed(outcome.stockReturnPct)} ／ オルカン {signed(outcome.benchmarkReturnPct)}
      </span>
      <span className="font-semibold">{outcome.correct ? "判断は的中" : "判断は外れ"}</span>
    </span>
  );
}

/** 判断の記録を、1年後・3年後にオルカンの同期間実績と並べる。勝率は評価できた件数だけで数える。 */
export function DecisionOutcomesPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useDecisions();
  const [deleting, setDeleting] = useState<DecisionView | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => sendJson(`/api/decisions/${encodeURIComponent(id)}`, "DELETE"),
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: DECISIONS_KEY });
    },
  });

  return (
    <section aria-labelledby="outcomes-heading" className="flex flex-col gap-3">
      <h2 id="outcomes-heading" className="text-sm font-bold text-text-primary">
        答え合わせ
      </h2>

      {isLoading ? <p className="text-sm text-text-secondary">読み込み中…</p> : null}
      {isError ? (
        <p role="alert" className="text-sm text-danger-text">
          判断の記録を読み込めませんでした。時間をおいて再読み込みしてください。
        </p>
      ) : null}

      {data && data.decisions.length === 0 ? (
        <p className="text-sm leading-6 text-text-secondary">
          判断を記録すると、1年後・3年後にオルカンと比べた結果がここに並びます。銘柄の「判断シート」から「購入判断として記録」または「見送りとして記録」を押してください。
        </p>
      ) : null}

      {data && data.decisions.length > 0 ? (
        <>
          {!data.benchmarkConfigured ? (
            <p className="rounded-button border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
              比べるオルカンが未設定のため、答え合わせができません。
              <Link href="/settings" className="ml-1 font-semibold text-primary hover:underline">
                設定で選ぶ →
              </Link>
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-3">
            {HORIZONS.map((h) => {
              const rate = data.winRates[h];
              return (
                <div key={h} className="rounded-card border border-border bg-surface p-4">
                  <dt className="text-xs text-text-muted">{horizonLabel(h)}の対オルカン勝率</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                    {rate.ratePct === null ? "—" : `${rate.ratePct.toFixed(0)}%`}
                  </dd>
                  <dd className="mt-1 text-xs text-text-muted">
                    {rate.evaluated === 0
                      ? "評価できる記録がまだありません"
                      : `${rate.evaluated}件中 ${rate.correct}件が的中（件数が少ないうちは参考値です）`}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-xs leading-5 text-text-muted">
            購入は「銘柄がオルカンを上回った」、見送りは「銘柄がオルカンを上回らなかった」を的中とします。銘柄は配当込みの実績、オルカンは保有CSVの取込などで記録した基準価額で比べます。
          </p>

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-subtle text-left text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">記録</th>
                  <th scope="col" className="px-3 py-2 font-semibold">判断時の前提</th>
                  {HORIZONS.map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">
                      {horizonLabel(h)}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {data.decisions.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2">
                      <span className="block font-semibold text-text-primary">{d.name}</span>
                      <span className="text-xs text-text-muted">
                        {d.decidedOn}・{d.decision === "buy" ? "購入判断" : "見送り"}・{formatPrice(d.price, d.currency)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-text-secondary">
                      中立の期待年率 {d.baseAnnualPct === null ? "未入力" : signed(d.baseAnnualPct)}
                      <br />
                      オルカン想定 {d.hurdlePct === null ? "未設定" : signed(d.hurdlePct)}
                    </td>
                    {HORIZONS.map((h) => (
                      <td key={h} className="px-3 py-2 text-xs">
                        <OutcomeCell outcome={d.outcomes[h]} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label={`${d.decidedOn}の${d.name}の記録を削除`}
                        onClick={() => setDeleting(d)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="この記録を削除しますか？">
        <p className="text-sm text-text-secondary">
          {deleting?.decidedOn} の {deleting?.name}（{deleting?.decision === "buy" ? "購入判断" : "見送り"}）の記録を削除します。答え合わせの対象から外れ、元に戻せません。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id)}
            className="min-h-11 rounded-button bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {remove.isPending ? "削除中..." : "削除する"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
