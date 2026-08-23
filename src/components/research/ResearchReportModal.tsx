"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ResearchReportSummary } from "@/server/repositories/evidence-repository";
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

async function patchReport(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/research/reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `update failed: ${res.status}`);
  }
  return res.json();
}

async function deleteReport(id: string) {
  const res = await fetch(`/api/research/reports/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `delete failed: ${res.status}`);
  }
  return res.json();
}

async function structureReport(id: string) {
  const res = await fetch(`/api/research/reports/${id}/structure`, { method: "POST" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `structure failed: ${res.status}`);
  }
  return res.json();
}

export function ResearchReportModal({
  report,
  onClose,
}: {
  report: ResearchReportSummary;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditable = report.importMode === "paste_text";
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rawContent, setRawContent] = useState(report.rawContent);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () => patchReport(report.id, { rawContent }),
    onSuccess: () => {
      setError(null);
      setIsEditing(false);
      router.refresh();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReport(report.id),
    onSuccess: () => {
      router.refresh();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const structureMutation = useMutation({
    mutationFn: () => structureReport(report.id),
    onSuccess: () => {
      router.refresh();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="rounded-button bg-surface-subtle px-2 py-0.5 font-semibold text-text-secondary">
              {report.sourceType ? (SOURCE_TYPE_LABEL[report.sourceType] ?? report.sourceType) : "—"}
            </span>
            <span>{report.sourceName ?? "情報源不明"}</span>
            <span>·</span>
            <span>{formatDate(report.researchDate ?? report.importedAt)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-button px-2 py-1 text-sm text-text-secondary hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {report.summary ? <p className="mt-3 text-sm font-semibold text-text-primary">{report.summary}</p> : null}

        <div className="mt-3 flex-1 overflow-y-auto">
          {isEditing ? (
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              rows={16}
              className="w-full rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-text-primary">{report.rawContent}</p>
          )}
        </div>

        {!isEditable && !isEditing ? (
          <p className="mt-2 text-xs text-text-muted">
            JSON形式で取り込まれた資料は編集できません。内容を変更する場合は削除して再度取り込んでください。
          </p>
        ) : null}

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-secondary">本当に削除しますか？関連する取り込みデータも削除されます。</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-button bg-danger px-3 py-1.5 font-semibold text-white disabled:opacity-60"
              >
                {deleteMutation.isPending ? "削除中..." : "削除する"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-button border border-border px-3 py-1.5 font-semibold text-text-secondary"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-button border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-surface-subtle"
            >
              削除
            </button>
          )}

          {isEditable ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setRawContent(report.rawContent);
                    setError(null);
                  }}
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || rawContent.trim().length === 0}
                  className="rounded-button bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  {updateMutation.isPending ? "保存中..." : "保存する"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => structureMutation.mutate()}
                  disabled={structureMutation.isPending}
                  title="本文をAIが読み取り、財務指標・経営陣発言・カタリスト・リスク等に自動分類します"
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {structureMutation.isPending ? "AI構造化中..." : "AIで構造化"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
                >
                  編集
                </button>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
