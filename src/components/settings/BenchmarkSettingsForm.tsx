"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendJson, SETTINGS_KEY, useSettings } from "@/features/candidates/api";

const fieldClass = "min-h-11 w-full rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus";

/**
 * 個別株の判断で比べる相手（オルカン）の設定。想定年率リターンは私が決めた値ではなく、あなたの入力値。
 * 空欄のままなら、判断シートは「ハードル未設定」と表示して差の計算をしない。
 */
export function BenchmarkSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useSettings();
  const [returnPct, setReturnPct] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setReturnPct(data.benchmarkExpectedReturn === null ? "" : String(data.benchmarkExpectedReturn));
    setInstrumentId(data.benchmarkInstrumentId ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (body: { benchmarkExpectedReturn: number | null; benchmarkInstrumentId: string | null }) =>
      sendJson("/api/settings", "PUT", body),
    onSuccess: () => {
      setError(null);
      setMessage("保存しました。");
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["decision-sheet"] });
    },
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = returnPct.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && !Number.isFinite(value)) {
      setError("想定年率は数値で入力してください。");
      return;
    }
    save.mutate({ benchmarkExpectedReturn: value, benchmarkInstrumentId: instrumentId === "" ? null : instrumentId });
  }

  return (
    <section aria-labelledby="benchmark-heading" className="rounded-card border border-border bg-surface p-5">
      <h2 id="benchmark-heading" className="text-sm font-bold text-text-primary">
        個別株の判断：オルカンとの比較
      </h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">
        個別株は「オルカンを買い増すより良いか」で判断します。比べる基準（想定年率）と、答え合わせに使う銘柄を設定します。
      </p>

      {isLoading ? <p className="mt-3 text-sm text-text-secondary">読み込み中…</p> : null}
      {isError ? (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          設定を読み込めませんでした。時間をおいて再読み込みしてください。
        </p>
      ) : null}

      {data ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="benchmark-return" className="text-xs font-semibold text-text-secondary">
              オルカンの想定年率リターン（%）
            </label>
            <input
              id="benchmark-return"
              type="number"
              step="any"
              inputMode="decimal"
              value={returnPct}
              onChange={(e) => setReturnPct(e.target.value)}
              placeholder="未入力なら差は計算されません"
              className={`${fieldClass} tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="benchmark-fund" className="text-xs font-semibold text-text-secondary">
              比べるオルカン（保有中の投資信託から選択）
            </label>
            <select
              id="benchmark-fund"
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              className={fieldClass}
            >
              <option value="">選択しない（答え合わせは不可）</option>
              {data.fundChoices.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {message ? (
            <p role="status" className="text-sm text-text-primary md:col-span-2">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger-text md:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {save.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
