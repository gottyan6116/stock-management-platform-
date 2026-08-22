"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

const SOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "perplexity", label: "Perplexity" },
  { value: "official_ir", label: "公式IR資料" },
  { value: "edinet", label: "EDINET" },
  { value: "sec", label: "SEC" },
  { value: "analyst", label: "アナリストレポート" },
  { value: "investor", label: "投資家意見" },
  { value: "news", label: "ニュース" },
  { value: "manual", label: "手入力" },
  { value: "other", label: "その他" },
];

async function submitImport(body: Record<string, unknown>) {
  const res = await fetch("/api/research/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `import failed: ${res.status}`);
  }
  return res.json();
}

export function ResearchImportForm({ providerSymbol, onDone }: { providerSymbol: string; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"paste_text" | "json">("paste_text");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("chatgpt");
  const [researchModel, setResearchModel] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitImport,
    onSuccess: () => {
      setError(null);
      setRawContent("");
      setJsonText("");
      router.refresh();
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "paste_text") {
      if (sourceName.trim().length === 0 || rawContent.trim().length === 0) {
        setError("情報源の名前と本文は必須です。");
        return;
      }
      mutation.mutate({
        providerSymbol,
        mode: "paste_text",
        sourceName,
        sourceType,
        researchModel: researchModel.trim() || undefined,
        rawContent,
      });
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      setError("JSONの形式が正しくありません（構文エラー）。");
      return;
    }
    mutation.mutate({ providerSymbol, mode: "json", json: parsedJson });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("paste_text")}
          className={`rounded-button px-3 py-1.5 text-xs font-semibold ${
            mode === "paste_text" ? "bg-primary text-white" : "bg-surface-subtle text-text-secondary"
          }`}
        >
          貼り付け
        </button>
        <button
          type="button"
          onClick={() => setMode("json")}
          className={`rounded-button px-3 py-1.5 text-xs font-semibold ${
            mode === "json" ? "bg-primary text-white" : "bg-surface-subtle text-text-secondary"
          }`}
        >
          JSON
        </button>
      </div>

      {mode === "paste_text" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="情報源名（例: ChatGPT Deep Research）"
              className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
            >
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={researchModel}
            onChange={(e) => setResearchModel(e.target.value)}
            placeholder="モデル名（任意、例: gpt-5-deep-research）"
            className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
          />
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={8}
            placeholder="外部AIやIR資料の調査結果をそのまま貼り付けてください。"
            className="w-full rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
          />
        </>
      ) : (
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={10}
          placeholder='{"company": {"ticker": "...", "name": "...", "exchange": "..."}, "researchDate": "2026-08-20", "sources": [], "financials": [], ...}'
          className="w-full rounded-button border border-border px-3 py-2 font-mono text-xs outline-none focus-visible:border-focus"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-fit rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {mutation.isPending ? "取り込み中..." : "取り込む"}
        </button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </form>
  );
}
