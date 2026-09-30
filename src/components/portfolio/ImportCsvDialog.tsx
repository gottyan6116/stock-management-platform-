"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { POSITIONS_KEY } from "@/features/portfolio/api";
import type { ImportAction, ImportPlan } from "@/lib/import/plan-fund-import";
import { dateFromFileName, parseRakutenFundCsv, type FundCsvRow } from "@/lib/import/rakuten-fund-csv";
import { ACCOUNT_LABEL } from "@/lib/portfolio/valuation";
import { cn } from "@/lib/utils/cn";
import { todayJst } from "@/lib/utils/format";

interface ApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  failed: { name: string; reason: string }[];
}

interface ImportResponse {
  plan: ImportPlan;
  asOf: string;
  applied: ApplyResult | null;
}

const ACTION_LABEL: Record<ImportAction, string> = { create: "新規", update: "更新", unchanged: "変更なし" };

function accountText(nisaType: FundCsvRow["nisaType"]): string {
  return nisaType === null ? ACCOUNT_LABEL.taxable : ACCOUNT_LABEL[nisaType];
}

const yen = (value: number | null) => (value === null ? "—" : `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`);
const units = (value: number) => `${value.toLocaleString("ja-JP")}口`;

async function callImport(rows: FundCsvRow[], asOf: string, apply: boolean): Promise<ImportResponse> {
  const res = await fetch("/api/positions/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, asOf, apply }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "取り込みに失敗しました。時間をおいて再度お試しください。");
  return body.data as ImportResponse;
}

function Change({ before, after, format }: { before: number | null | undefined; after: number | null; format: (v: number) => string }) {
  if (after === null) return <span className="text-text-muted">—</span>;
  if (before === undefined || before === null || before === after) return <span>{format(after)}</span>;
  return (
    <span>
      <span className="block text-xs text-text-muted line-through">{format(before)}</span>
      {format(after)}
    </span>
  );
}

/** 楽天証券「保有商品（投資信託）」CSVの取込。選択→差分プレビュー→確認→反映の順で、選んだだけではDBを変更しない。 */
export function ImportCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<FundCsvRow[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setRows([]);
    setParseWarnings([]);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const text = new TextDecoder("shift_jis").decode(await file.arrayBuffer());
      const parsed = parseRakutenFundCsv(text);
      if (parsed.fatal) {
        setError(parsed.fatal);
        return;
      }
      const asOf = dateFromFileName(file.name) ?? todayJst();
      setRows(parsed.rows);
      setParseWarnings(parsed.warnings);
      setPreview(await callImport(parsed.rows, asOf, false));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ファイルを読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await callImport(rows, preview.asOf, true);
      setResult(response.applied);
      await queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
    } catch (e) {
      setError(e instanceof Error ? e.message : "取り込みに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  const items = preview?.plan.items ?? [];
  const changeCount = items.filter((i) => i.action !== "unchanged").length;
  const warnings = [...parseWarnings, ...(preview?.plan.warnings ?? [])];

  return (
    <Modal open={open} onClose={handleClose} title="楽天証券のCSVを取り込む" wide>
      {result ? (
        <div>
          <p className="text-sm text-text-primary">
            反映しました：新規 {result.created}件・更新 {result.updated}件・変更なし {result.unchanged}件
          </p>
          {result.failed.length > 0 ? (
            <ul role="alert" className="mt-3 list-disc pl-5 text-sm text-danger-text">
              {result.failed.map((f) => (
                <li key={f.name}>
                  {f.name}：保存できませんでした（{f.reason}）
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 rounded-button bg-text-primary px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-6 text-text-secondary">
            楽天証券の「保有商品（投資信託）」画面で「CSVで保存」したファイルを選んでください。選んだだけでは保有は変更されず、次の画面で差分を確認してから反映します。CSVに無い保有は変更・削除しません。
          </p>
          <label className="mt-4 flex flex-col gap-1 text-sm font-semibold text-text-primary">
            CSVファイル
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => void handleFile(e.target.files?.[0])}
              className="min-h-11 rounded-button border border-border px-3 py-2 text-sm font-normal file:mr-3 file:rounded-button file:border-0 file:bg-surface-subtle file:px-3 file:py-1.5"
            />
          </label>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger-text">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="mt-4">
              <p className="text-sm text-text-primary">
                基準日 {preview.asOf}：新規 {items.filter((i) => i.action === "create").length}件・更新{" "}
                {items.filter((i) => i.action === "update").length}件・変更なし{" "}
                {items.filter((i) => i.action === "unchanged").length}件
                {preview.plan.untouchedCount > 0
                  ? `（CSVに無い既存の投資信託${preview.plan.untouchedCount}件は変更しません）`
                  : ""}
              </p>
              <div className="mt-3 overflow-x-auto rounded-card border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-surface-subtle text-left text-xs text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">ファンド・口座</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">保有数量</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">平均取得価額（1万口）</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">基準価額（1万口）</th>
                      <th scope="col" className="px-3 py-2 font-semibold">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr key={`${item.row.name}|${item.row.accountLabel}`}>
                        <td className="px-3 py-2">
                          <span className="block font-semibold text-text-primary">{item.row.name}</span>
                          <span className="text-xs text-text-muted">{accountText(item.row.nisaType)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <Change before={item.before?.quantity} after={item.row.quantity} format={units} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <Change before={item.before?.avgCost} after={item.row.avgCostPer10k} format={yen} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <Change before={item.before?.nav} after={item.row.nav} format={yen} />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-block rounded-full border px-2 py-0.5 text-xs font-semibold",
                              item.action === "unchanged"
                                ? "border-border text-text-muted"
                                : "border-primary text-primary"
                            )}
                          >
                            {ACTION_LABEL[item.action]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-xs text-text-secondary">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 rounded-button border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={busy || !preview || changeCount === 0}
              className="min-h-11 rounded-button bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? "処理中..." : changeCount === 0 && preview ? "変更はありません" : `この内容で反映（${changeCount}件）`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
