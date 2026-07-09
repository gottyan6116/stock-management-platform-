"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface ParsedRow {
  priceDate: string;
  unitPrice: number;
}

function parseLines(text: string): ParsedRow[] | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const rows: ParsedRow[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((part) => part.trim());
    if (parts.length < 2) return null;

    const [rawDate, rawPrice] = parts;
    if (!rawDate || !rawPrice) return null;
    const dateMatch = rawDate.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!dateMatch) return null;
    const [, y, m, d] = dateMatch;
    if (!y || !m || !d) return null;
    const priceDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

    const unitPrice = Number(rawPrice.replace(/[,円]/g, ""));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;

    rows.push({ priceDate, unitPrice });
  }
  return rows;
}

async function submitRows(instrumentId: string, rows: ParsedRow[]) {
  const res = await fetch(`/api/funds/${encodeURIComponent(instrumentId)}/prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `bulk import failed: ${res.status}`);
  }
}

/** 証券会社の投信ページに表示されている過去の基準価額を、日付,価格の行で貼り付けて一括登録するフォーム。 */
export function ManualFundPriceHistoryForm({ instrumentId }: { instrumentId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (rows: ParsedRow[]) => submitRows(instrumentId, rows),
    onSuccess: (_result, rows) => {
      setSuccess(`${rows.length}件の基準価額を取り込みました。`);
      setError(null);
      setText("");
      router.refresh();
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rows = parseLines(text);
    if (!rows) {
      setError(
        "形式が正しくありません。1行につき「日付,基準価額」（例: 2026-06-19,59602）で入力してください。"
      );
      setSuccess(null);
      return;
    }
    setError(null);
    mutation.mutate(rows);
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="mb-1 text-sm font-bold text-text-primary">基準価額の履歴を一括取り込み</p>
      <p className="mb-3 text-xs text-text-muted">
        証券会社の投信ページに表示されている過去の基準価額を、1行ずつ「日付,基準価額」の形式で貼り付けてください（カンマまたはタブ区切り、日付は
        2026-06-19 または 2026/06/19 形式）。既存の同日データは上書きされます。
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"2024-06-19,54200\n2025-06-19,58900\n2026-06-19,59602"}
          className="w-full rounded-button border border-border px-3 py-2 font-mono text-xs outline-none focus-visible:border-focus"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || text.trim().length === 0}
            className="w-fit rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {mutation.isPending ? "取り込み中..." : "取り込む"}
          </button>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {success ? <p className="text-xs text-success">{success}</p> : null}
        </div>
      </form>
    </div>
  );
}
