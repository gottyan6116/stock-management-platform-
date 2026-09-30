"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import {
  CANDIDATES_KEY,
  DECISIONS_KEY,
  sendJson,
  sheetKey,
  useDecisionSheet,
} from "@/features/candidates/api";
import {
  computeScenario,
  excessOverHurdle,
  HORIZON_YEARS,
  SCENARIO_KEYS,
  SCENARIO_LABEL,
  type ScenarioKey,
} from "@/lib/candidates/expected-return";
import { emptyScenarios, type ScenarioInputs } from "@/lib/candidates/scenarios";
import { formatCurrency, formatPrice } from "@/lib/utils/format";

type Draft = Record<ScenarioKey, { epsGrowthPct: string; exitPer: string }>;

const toText = (v: number | null) => (v === null ? "" : String(v));
const toNum = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function toDraft(inputs: ScenarioInputs): Draft {
  return Object.fromEntries(
    SCENARIO_KEYS.map((k) => [k, { epsGrowthPct: toText(inputs[k].epsGrowthPct), exitPer: toText(inputs[k].exitPer) }])
  ) as Draft;
}

function fromDraft(draft: Draft): ScenarioInputs {
  const result = emptyScenarios();
  for (const k of SCENARIO_KEYS) {
    result[k] = { epsGrowthPct: toNum(draft[k].epsGrowthPct), exitPer: toNum(draft[k].exitPer) };
  }
  return result;
}

/** ±の符号つき（色だけに頼らない）。 */
function signedPct(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}%`;
}
function signedPt(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}pt`;
}

const fieldClass = "min-h-11 w-full rounded-button border border-border px-3 text-sm outline-none focus-visible:border-focus";

/**
 * 個別株の判断シート。株価の予測ではなく、入力した前提が全部当たった場合の年率リターンを
 * 「配当利回り＋EPS成長＋バリュエーション変化」に分解して、オルカンの想定リターンと比べる。
 */
export function DecisionSheet({ instrumentId }: { instrumentId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useDecisionSheet(instrumentId);

  const [why, setWhy] = useState("");
  const [wrong, setWrong] = useState("");
  const [draft, setDraft] = useState<Draft>(() => toDraft(emptyScenarios()));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"buy" | "pass" | null>(null);

  useEffect(() => {
    if (!data) return;
    setWhy(data.sheet.thesisWhy);
    setWrong(data.sheet.thesisWrong);
    setDraft(toDraft(data.sheet.scenarios));
  }, [data]);

  const inputs = useMemo(() => fromDraft(draft), [draft]);
  const results = useMemo(
    () =>
      data
        ? Object.fromEntries(
            SCENARIO_KEYS.map((k) => [
              k,
              computeScenario({
                dividendYieldPct: data.market.dividendYieldPct,
                currentPer: data.market.currentPer,
                input: inputs[k],
              }),
            ])
          )
        : null,
    [data, inputs]
  );

  const save = useMutation({
    mutationFn: () => sendJson(`/api/decision-sheets/${encodeURIComponent(instrumentId)}`, "PUT", { thesisWhy: why, thesisWrong: wrong, scenarios: inputs }),
    onSuccess: () => {
      setError(null);
      setMessage("下書きを保存しました。");
      void queryClient.invalidateQueries({ queryKey: sheetKey(instrumentId) });
    },
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });

  const record = useMutation({
    mutationFn: (decision: "buy" | "pass") =>
      sendJson("/api/decisions", "POST", { instrumentId, decision, thesisWhy: why, thesisWrong: wrong, scenarios: inputs }),
    onSuccess: (_r, decision) => {
      setError(null);
      setConfirming(null);
      setMessage(decision === "buy" ? "購入判断として記録しました。" : "見送りとして記録しました。");
      void queryClient.invalidateQueries({ queryKey: DECISIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
    },
    onError: (e: Error) => {
      setConfirming(null);
      setMessage(null);
      setError(e.message);
    },
  });

  if (isLoading) return <p className="text-sm text-text-secondary">判断シートを読み込み中…</p>;
  if (isError || !data || !results) {
    return (
      <p role="alert" className="text-sm text-danger-text">
        判断シートを読み込めませんでした。時間をおいて再読み込みしてください。
      </p>
    );
  }

  const { market, hurdlePct, benchmark } = data;
  const setField = (key: ScenarioKey, field: "epsGrowthPct" | "exitPer", value: string) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-button border border-border bg-surface-subtle px-3 py-2 text-xs leading-5 text-text-secondary">
        これは株価の予測ではありません。入力した前提が<strong>すべて当たった場合</strong>の年率リターンを、下の式で計算しています。
      </p>

      <section aria-labelledby="thesis-heading" className="grid gap-4 md:grid-cols-2">
        <h3 id="thesis-heading" className="text-sm font-bold text-text-primary md:col-span-2">
          投資仮説
        </h3>
        <div className="flex flex-col gap-1">
          <label htmlFor="thesis-why" className="text-xs font-semibold text-text-secondary">
            なぜ上がるか
          </label>
          <textarea id="thesis-why" rows={4} value={why} onChange={(e) => setWhy(e.target.value)} className={`${fieldClass} py-2`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="thesis-wrong" className="text-xs font-semibold text-text-secondary">
            何が起きたら間違いか
          </label>
          <textarea id="thesis-wrong" rows={4} value={wrong} onChange={(e) => setWrong(e.target.value)} className={`${fieldClass} py-2`} />
        </div>
      </section>

      <section aria-labelledby="market-heading">
        <h3 id="market-heading" className="text-sm font-bold text-text-primary">
          自動取得した前提
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">現在値</dt>
            <dd className="font-bold tabular-nums">{market.price === null ? "—" : formatPrice(market.price, market.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">配当利回り（予想）</dt>
            <dd className="font-bold tabular-nums">{market.dividendYieldPct === null ? "—" : `${market.dividendYieldPct.toFixed(2)}%`}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">現在PER（実績）</dt>
            <dd className="font-bold tabular-nums">{market.currentPer === null ? "—" : `${market.currentPer.toFixed(1)}倍`}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">ハードル（オルカン想定年率）</dt>
            <dd className="font-bold tabular-nums">{hurdlePct === null ? "未設定" : `${hurdlePct.toFixed(1)}%`}</dd>
          </div>
        </dl>
        {market.currentPer === null ? (
          <p className="mt-2 text-xs text-text-muted">現在PERを取得できません（赤字などの場合）。PERを使うシナリオ計算はできません。</p>
        ) : null}
        {hurdlePct === null ? (
          <p className="mt-2 text-xs text-text-muted">
            比較の基準になる、オルカンの想定年率リターンが未入力です。
            <Link href="/settings" className="ml-1 font-semibold text-primary hover:underline">
              設定で入力する →
            </Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="scenario-heading">
        <h3 id="scenario-heading" className="text-sm font-bold text-text-primary">
          期待リターンの分解（年率・{HORIZON_YEARS}年）
        </h3>
        <div className="mt-2 overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-subtle text-left text-xs text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">項目</th>
                {SCENARIO_KEYS.map((k) => (
                  <th key={k} scope="col" className="px-3 py-2 text-right font-semibold">
                    {SCENARIO_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  EPS成長率（%/年）<span className="text-text-muted">入力</span>
                </th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2">
                    <input
                      aria-label={`${SCENARIO_LABEL[k]}のEPS成長率（%/年）`}
                      type="number"
                      step="any"
                      value={draft[k].epsGrowthPct}
                      onChange={(e) => setField(k, "epsGrowthPct", e.target.value)}
                      className={`${fieldClass} text-right tabular-nums`}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {HORIZON_YEARS}年後に想定するPER（倍）<span className="text-text-muted">入力</span>
                </th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2">
                    <input
                      aria-label={`${SCENARIO_LABEL[k]}の${HORIZON_YEARS}年後PER（倍）`}
                      type="number"
                      step="any"
                      value={draft[k].exitPer}
                      onChange={(e) => setField(k, "exitPer", e.target.value)}
                      className={`${fieldClass} text-right tabular-nums`}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">配当利回り（自動）</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">{signedPct(results[k]!.dividendPct)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">EPS成長</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">{signedPct(results[k]!.epsGrowthPct)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">バリュエーション変化（年率換算）</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">{signedPct(results[k]!.valuationPct)}</td>
                ))}
              </tr>
              <tr className="bg-surface-subtle">
                <th scope="row" className="px-3 py-2 text-left font-bold">期待年率</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right text-base font-bold tabular-nums">{signedPct(results[k]!.totalAnnualPct)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-normal">{HORIZON_YEARS}年累計</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">{signedPct(results[k]!.fiveYearTotalPct, 0)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-bold">オルカン想定との差</th>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-right font-bold tabular-nums">
                    {signedPt(excessOverHurdle(results[k]!.totalAnnualPct, hurdlePct))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-text-muted">
          {SCENARIO_KEYS.map((k) =>
            results[k]!.missing ? (
              <li key={k}>
                {SCENARIO_LABEL[k]}：{results[k]!.missing}
              </li>
            ) : null
          )}
        </ul>

        <div className="mt-3 rounded-button border border-border px-3 py-2 text-xs leading-6 text-text-secondary">
          <p className="font-semibold text-text-primary">計算式（前提）</p>
          <p>バリュエーション年率変化 ＝ ({HORIZON_YEARS}年後PER ÷ 現在PER)^(1/{HORIZON_YEARS}) − 1</p>
          <p>価格の年率 ＝ (1 ＋ EPS成長率) × (1 ＋ バリュエーション年率変化) − 1</p>
          <p>期待年率 ≒ 配当利回り ＋ 価格の年率（配当は再投資しない近似）</p>
          <p>{HORIZON_YEARS}年累計 ＝ (1 ＋ 期待年率)^{HORIZON_YEARS} − 1</p>
          <p>オルカン想定との差 ＝ 期待年率 − オルカンの想定年率（設定で入力した値）</p>
        </div>
      </section>

      {message ? (
        <p role="status" className="text-sm text-text-primary">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle disabled:opacity-60"
        >
          {save.isPending ? "保存中..." : "下書きを保存"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming("buy")}
          className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          購入判断として記録
        </button>
        <button
          type="button"
          onClick={() => setConfirming("pass")}
          className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle"
        >
          見送りとして記録
        </button>
      </div>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "buy" ? "購入判断として記録しますか？" : "見送りとして記録しますか？"}
      >
        <p className="text-sm leading-6 text-text-secondary">
          いまの株価（{market.price === null ? "—" : formatCurrency(market.price, market.currency)}）、配当利回り、PER、上の前提と計算結果、
          {benchmark ? `オルカンの基準価額（${benchmark.name}）` : "オルカンの基準価額（比較する銘柄が未設定のため記録されません）"}
          を、この日付で保存します。保存した記録は書き換えできません（削除のみ可能）。1年後・3年後に、オルカンと比べて答え合わせします。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={record.isPending}
            onClick={() => confirming && record.mutate(confirming)}
            className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {record.isPending ? "記録中..." : "記録する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
