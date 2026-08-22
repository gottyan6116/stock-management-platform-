"use client";

import { useState } from "react";
import type { ResearchReportSummary } from "@/server/repositories/evidence-repository";
import { ResearchImportForm } from "./ResearchImportForm";
import { formatDate } from "@/lib/utils/format";

const SOURCE_TYPE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  official_ir: "公式IR資料",
  edinet: "EDINET",
  sec: "SEC",
  analyst: "アナリストレポート",
  investor: "投資家意見",
  news: "ニュース",
  manual: "手入力",
  other: "その他",
};

export function ResearchSection({
  providerSymbol,
  reports,
}: {
  providerSymbol: string;
  reports: ResearchReportSummary[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-text-primary">リサーチ</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
        >
          {showForm ? "閉じる" : "資料を追加"}
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          まだ資料がありません。ChatGPTなどで調査した内容や、IR資料の要約を「資料を追加」から取り込めます。
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-button border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span className="rounded-button bg-surface-subtle px-2 py-0.5 font-semibold text-text-secondary">
                  {report.sourceType ? (SOURCE_TYPE_LABEL[report.sourceType] ?? report.sourceType) : "—"}
                </span>
                <span>{report.sourceName ?? "情報源不明"}</span>
                <span>·</span>
                <span>{formatDate(report.researchDate ?? report.importedAt)}</span>
              </div>
              {report.summary ? <p className="mt-1 text-sm text-text-primary">{report.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="mt-4">
          <ResearchImportForm providerSymbol={providerSymbol} onDone={() => setShowForm(false)} />
        </div>
      ) : null}
    </div>
  );
}
