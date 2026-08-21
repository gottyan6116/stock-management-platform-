"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { MetricKey } from "@/types/evidence";

export const METRIC_KEY_LABEL: Record<MetricKey, string> = {
  revenue: "売上高",
  operating_income: "営業利益",
  net_income: "純利益",
  eps: "EPS",
  fcf: "フリーキャッシュフロー",
  cash: "現金及び現金同等物",
  debt: "有利子負債",
  roe: "ROE",
  roic: "ROIC",
  operating_margin: "営業利益率",
  net_margin: "純利益率",
  per: "PER",
  pbr: "PBR",
  ev_ebitda: "EV/EBITDA",
  dividend_yield: "配当利回り",
  dividend_payout: "配当性向",
  current_ratio: "流動比率",
  net_debt: "純有利子負債",
  net_debt_ebitda: "純有利子負債/EBITDA",
  fcf_yield: "FCF利回り",
  fcf_margin: "FCFマージン",
};

const METRIC_KEY_OPTIONS = Object.entries(METRIC_KEY_LABEL) as [MetricKey, string][];

async function submitMetric(body: Record<string, unknown>) {
  const res = await fetch("/api/research/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `submit failed: ${res.status}`);
  }
  return res.json();
}

export function ManualMetricForm({ providerSymbol }: { providerSymbol: string }) {
  const router = useRouter();
  const [metricKey, setMetricKey] = useState<MetricKey>("revenue");
  const [value, setValue] = useState("");
  const [periodType, setPeriodType] = useState<"FY" | "Q">("FY");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitMetric,
    onSuccess: () => {
      setError(null);
      setSuccess("保存しました。");
      setValue("");
      router.refresh();
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const numericValue = Number(value);
    if (value.trim().length === 0 || !Number.isFinite(numericValue)) {
      setError("有効な数値を入力してください。");
      return;
    }
    if (periodStart.trim().length === 0 || periodEnd.trim().length === 0) {
      setError("対象期間の開始日と終了日を入力してください。");
      return;
    }

    mutation.mutate({
      providerSymbol,
      metricKey,
      value: numericValue,
      periodType,
      periodStart,
      periodEnd,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value as MetricKey)}
          className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
        >
          {METRIC_KEY_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="number"
          step="any"
          placeholder="値"
          className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
        />
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as "FY" | "Q")}
          className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
        >
          <option value="FY">通期</option>
          <option value="Q">四半期</option>
        </select>
        <div className="flex gap-1">
          <input
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            type="date"
            className="w-full rounded-button border border-border px-2 py-2 text-sm outline-none focus-visible:border-focus"
          />
          <input
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            type="date"
            className="w-full rounded-button border border-border px-2 py-2 text-sm outline-none focus-visible:border-focus"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-fit rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {mutation.isPending ? "保存中..." : "指標を追加"}
        </button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {success ? <p className="text-xs text-success">{success}</p> : null}
      </div>
    </form>
  );
}
