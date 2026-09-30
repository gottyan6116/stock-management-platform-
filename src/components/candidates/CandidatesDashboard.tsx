"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { CardSkeleton } from "@/components/feedback/Skeleton";
import { DecisionOutcomesPanel } from "@/components/candidates/DecisionOutcomesPanel";
import { CANDIDATES_KEY, sendJson, useCandidates, type CandidateItem } from "@/features/candidates/api";
import { useFavoriteQuotes } from "@/features/favorites/quotes";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABEL,
  isCandidateStatus,
  type CandidateStatus,
} from "@/lib/candidates/status";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

type Filter = "all" | CandidateStatus;

/** 候補（個別株のお気に入り）を状態で管理し、判断シートと答え合わせへつなぐ。 */
export function CandidatesDashboard() {
  const queryClient = useQueryClient();
  const { data: candidates = [], isLoading, isError } = useCandidates();
  const { data: quotes } = useFavoriteQuotes();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const priceBySymbol = useMemo(() => new Map((quotes ?? []).map((q) => [q.providerSymbol, q])), [quotes]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(CANDIDATE_STATUSES.map((s) => [s, 0])) as Record<CandidateStatus, number>;
    for (const c of candidates) result[c.status] += 1;
    return result;
  }, [candidates]);

  const rows = filter === "all" ? candidates : candidates.filter((c) => c.status === filter);

  const changeStatus = useMutation({
    mutationFn: ({ instrumentId, status }: { instrumentId: string; status: CandidateStatus }) =>
      sendJson(`/api/candidates/${encodeURIComponent(instrumentId)}`, "PATCH", { status }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading) return <CardSkeleton />;

  if (isError) {
    return (
      <p role="alert" className="rounded-button border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-text">
        候補を読み込めませんでした。時間をおいて再読み込みしてください。登録済みのデータは変更されていません。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {candidates.length === 0 ? (
        <EmptyState
          icon={Star}
          title="まだ候補がありません"
          description="銘柄名・コード・ティッカーで検索して、詳細ページの☆で候補に追加してください"
          action={
            <button
              type="button"
              onClick={() => document.getElementById("global-stock-search-input")?.focus()}
              className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              銘柄を検索
            </button>
          }
        />
      ) : (
        <section aria-labelledby="candidate-list-heading" className="flex flex-col gap-3">
          <h2 id="candidate-list-heading" className="text-sm font-bold text-text-primary">
            候補一覧
          </h2>
          <div role="group" aria-label="状態で絞り込み" className="flex flex-wrap gap-2">
            {(["all", ...CANDIDATE_STATUSES] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  filter === key
                    ? "border-text-primary bg-text-primary text-white"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-subtle"
                )}
              >
                {key === "all" ? `すべて ${candidates.length}` : `${CANDIDATE_STATUS_LABEL[key]} ${counts[key]}`}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-subtle text-left text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">銘柄</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">現在値</th>
                  <th scope="col" className="px-3 py-2 font-semibold">状態</th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">判断シート</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c: CandidateItem) => {
                  const quote = priceBySymbol.get(c.providerSymbol);
                  return (
                    <tr key={c.instrumentId}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/stocks/${encodeURIComponent(c.providerSymbol)}`}
                          className="block font-semibold text-text-primary hover:text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="text-xs text-text-muted">{c.displaySymbol}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {quote?.displayPrice == null ? "—" : formatPrice(quote.displayPrice, c.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`${c.name}の状態`}
                          value={c.status}
                          onChange={(e) => {
                            if (isCandidateStatus(e.target.value)) {
                              changeStatus.mutate({ instrumentId: c.instrumentId, status: e.target.value });
                            }
                          }}
                          className="min-h-11 rounded-button border border-border bg-surface px-2 text-sm"
                        >
                          {CANDIDATE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {CANDIDATE_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/stocks/${encodeURIComponent(c.providerSymbol)}?tab=decision`}
                          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                        >
                          判断シート →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-text-secondary">
                      この状態の候補はありません。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DecisionOutcomesPanel />
    </div>
  );
}
