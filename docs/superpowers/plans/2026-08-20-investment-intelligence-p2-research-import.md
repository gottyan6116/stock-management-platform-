# Investment Intelligence — Phase P2: Research Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user paste unstructured research text OR a structured `ResearchImportSchema`-shaped JSON (produced by an external AI tool per Phase P1's schema) into a new "資料を追加" form on the stock detail page, and have it persist into the Phase P1 evidence tables. No R2, no PDF, no manual-metrics-only form (that's P3). This phase makes the import loop real end-to-end for the two cheapest input modes.

**Architecture:** One repository module doing the read/write cascade against Phase P1's tables, one POST API route following this repo's existing Zod-at-top-of-route convention, and one additive UI section appended to the existing (non-tabbed) stock detail page — no new Dialog/Drawer primitive, since this codebase has none and every existing form (`ManualFundPriceHistoryForm`) is a plain inline card that expands in place.

**Tech Stack:** Same as P1 (Next.js 14 App Router, Supabase, Zod, TanStack Query `useMutation`), building directly on P1's `research_sources`/`research_reports`/`financial_metrics`/`management_statements`/`company_events`/`company_risks`/`company_catalysts`/`research_opinions` tables and `ResearchImportSchema` (`src/lib/evidence/schemas.ts`, already on this branch).

## Global Constraints

- New DB writes always resolve the target `instruments.id` UUID server-side via the existing `resolveOrCreateInstrument(providerSymbol)` (`src/server/services/resolve-instrument.ts`) — the client never sends or knows a raw `instruments.id` for a Yahoo-backed symbol (that field is deceptively populated with the provider symbol string on the current stock detail page, see `src/app/(dashboard)/stocks/[symbol]/page.tsx:132`, and must not be relied on as a real UUID anywhere in this phase).
- All new API-route Zod schemas live inline at the top of the route file, matching every existing route (`src/app/api/favorites/route.ts`, `src/app/api/positions/route.ts`, etc.) — no shared `src/lib/validation/` folder.
- All new Supabase writes go through the user-scoped client (`createClient()` from `src/lib/supabase/server.ts`), never the service-role client — RLS (`auth.uid() = user_id`) is the only access control for every P1 evidence table, and the service-role client is reserved for the existing shared-table exception (`resolveOrCreateInstrument`'s writes to `instruments`, which this phase reuses but does not modify).
- Every new component uses the existing design tokens only (`rounded-card`, `rounded-button`, `border-border`, `bg-surface`, `text-primary`/`text-secondary`/`text-muted`, `bg-primary`/`hover:bg-primary-hover`) — no new colors, no new UI library.
- Mutations follow the existing `useMutation` + `router.refresh()` pattern (`src/components/funds/ManualFundPriceHistoryForm.tsx`) — no client-side cache mutation, no optimistic updates (not used anywhere else in this codebase).
- `apiError(code, message?)` (`src/lib/errors/api-error.ts`) is the only response shape for failures; success responses are `NextResponse.json({ data: ... })`.
- After every code step: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit` must pass with zero errors.
- This codebase has no route-handler or repository unit tests anywhere (confirmed: `tests/unit/` contains only pure-function tests) — do not invent a new testing pattern for this phase's repository/route files; match the existing convention (type-check only for these two files). The `ResearchImportSchema` itself is already tested in P1.
- Work happens in the existing worktree/branch (`feature/investment-intelligence-p1` at `C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1`), continuing directly on top of P1's already-merged-into-this-branch commits (`aa912a7`, fix `e7748b9`). Do not create a new worktree or branch.

---

### Task 1: Evidence repository + import API route

**Files:**
- Create: `src/server/repositories/evidence-repository.ts`
- Create: `src/app/api/research/import/route.ts`

**Interfaces:**
- Consumes: `ResearchImportSchema`, `ResearchImportInput`, `SourceInput` from `src/lib/evidence/schemas.ts` (P1); `Database` from `src/types/supabase.ts` (P1); `resolveOrCreateInstrument` from `src/server/services/resolve-instrument.ts`; `apiError` from `src/lib/errors/api-error.ts`; `createClient` from `src/lib/supabase/server.ts`.
- Produces: `insertPasteReport(supabase, params)`, `insertJsonImport(supabase, userId, instrumentId, input)`, `listResearchReports(supabase, instrumentId)` — consumed by Task 2's UI and by the page.

- [ ] **Step 1: Write the repository**

```ts
// src/server/repositories/evidence-repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ResearchImportInput } from "@/lib/evidence/schemas";

type ResearchReportRow = Database["public"]["Tables"]["research_reports"]["Row"];
type ResearchSourceInsert = Database["public"]["Tables"]["research_sources"]["Insert"];

export interface ResearchReportSummary {
  id: string;
  importMode: ResearchReportRow["import_mode"];
  researchDate: string | null;
  researchModel: string | null;
  summary: string | null;
  importedAt: string;
  sourceName: string | null;
  sourceType: Database["public"]["Tables"]["research_sources"]["Row"]["source_type"] | null;
}

export interface InsertPasteReportParams {
  userId: string;
  instrumentId: string;
  sourceName: string;
  sourceType: Database["public"]["Tables"]["research_sources"]["Row"]["source_type"];
  sourceUrl?: string;
  researchModel?: string;
  rawContent: string;
  userNotes?: string;
}

/** 貼り付けテキスト（未構造化）の取り込み。sources 1件 + research_reports 1件のみ作成し、構造化evidenceは作らない。 */
export async function insertPasteReport(
  supabase: SupabaseClient<Database>,
  params: InsertPasteReportParams
): Promise<ResearchReportRow> {
  const { data: source, error: sourceError } = await supabase
    .from("research_sources")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      source_type: params.sourceType,
      source_name: params.sourceName,
      source_url: params.sourceUrl,
    })
    .select()
    .single();
  if (sourceError) throw sourceError;

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      source_id: source.id,
      import_mode: "paste_text",
      research_model: params.researchModel,
      raw_content: params.rawContent,
      user_notes: params.userNotes,
    })
    .select()
    .single();
  if (reportError) throw reportError;

  return report;
}

/** 構造化JSON（ResearchImportSchema検証済み）の取り込み。sources → research_reports → 各evidenceテーブルへカスケードする。 */
export async function insertJsonImport(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrumentId: string,
  input: ResearchImportInput
): Promise<{ reportId: string; sourcesCreated: number }> {
  const sourceKeyToId = new Map<string, string>();

  if (input.sources.length > 0) {
    const sourceRows: ResearchSourceInsert[] = input.sources.map((source) => ({
      user_id: userId,
      instrument_id: instrumentId,
      source_type: source.sourceType,
      source_name: source.sourceName,
      source_url: source.sourceUrl,
      evidence_class: source.evidenceClass,
      reliability: source.reliability,
    }));
    const { data: insertedSources, error: sourcesError } = await supabase
      .from("research_sources")
      .insert(sourceRows)
      .select("id");
    if (sourcesError) throw sourcesError;
    insertedSources.forEach((row, index) => {
      const sourceKey = input.sources[index]?.sourceKey;
      if (sourceKey) sourceKeyToId.set(sourceKey, row.id);
    });
  }

  const primarySourceId = input.sources.length > 0 ? (sourceKeyToId.values().next().value ?? null) : null;

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .insert({
      user_id: userId,
      instrument_id: instrumentId,
      source_id: primarySourceId,
      import_mode: "json",
      research_date: input.researchDate,
      raw_content: JSON.stringify(input),
      structured_json: input,
      summary: input.summary,
    })
    .select()
    .single();
  if (reportError) throw reportError;

  const resolveSourceId = (sourceKey?: string) => (sourceKey ? (sourceKeyToId.get(sourceKey) ?? null) : null);

  if (input.financials.length > 0) {
    const { error } = await supabase.from("financial_metrics").insert(
      input.financials.map((metric) => ({
        user_id: userId,
        instrument_id: instrumentId,
        metric_key: metric.metricKey,
        value: metric.value,
        unit: metric.unit,
        currency: metric.currency,
        period_type: metric.periodType,
        period_start: metric.periodStart,
        period_end: metric.periodEnd,
        reported_at: metric.reportedAt,
        source_id: resolveSourceId(metric.sourceKey),
        source_report_id: report.id,
        is_manual: false,
      }))
    );
    if (error) throw error;
  }

  if (input.managementStatements.length > 0) {
    const { error } = await supabase.from("management_statements").insert(
      input.managementStatements.map((statement) => ({
        user_id: userId,
        instrument_id: instrumentId,
        person_name: statement.personName,
        role: statement.role,
        statement: statement.statement,
        statement_date: statement.statementDate,
        topic: statement.topic,
        page: statement.page,
        confidence: statement.confidence,
        source_id: resolveSourceId(statement.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  if (input.catalysts.length > 0) {
    const { error } = await supabase.from("company_catalysts").insert(
      input.catalysts.map((catalyst) => ({
        user_id: userId,
        instrument_id: instrumentId,
        catalyst_type: catalyst.catalystType,
        description: catalyst.description,
        expected_timing: catalyst.expectedTiming,
        impact: catalyst.impact,
        source_id: resolveSourceId(catalyst.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  if (input.risks.length > 0) {
    const { error } = await supabase.from("company_risks").insert(
      input.risks.map((risk) => ({
        user_id: userId,
        instrument_id: instrumentId,
        risk_type: risk.riskType,
        description: risk.description,
        severity: risk.severity,
        likelihood: risk.likelihood,
        detected_at: risk.detectedAt,
        source_id: resolveSourceId(risk.sourceKey),
      }))
    );
    if (error) throw error;
  }

  if (input.investorOpinions.length > 0) {
    const { error } = await supabase.from("research_opinions").insert(
      input.investorOpinions.map((opinion) => ({
        user_id: userId,
        instrument_id: instrumentId,
        author: opinion.author,
        organization: opinion.organization,
        stance: opinion.stance,
        summary: opinion.summary,
        rating: opinion.rating,
        target_price: opinion.targetPrice,
        published_at: opinion.publishedAt,
        source_url: opinion.sourceUrl,
        source_id: resolveSourceId(opinion.sourceKey),
      }))
    );
    if (error) throw error;
  }

  if (input.events.length > 0) {
    const { error } = await supabase.from("company_events").insert(
      input.events.map((event) => ({
        user_id: userId,
        instrument_id: instrumentId,
        event_type: event.eventType,
        title: event.title,
        description: event.description,
        event_date: event.eventDate,
        source_id: resolveSourceId(event.sourceKey),
        source_report_id: report.id,
      }))
    );
    if (error) throw error;
  }

  return { reportId: report.id, sourcesCreated: input.sources.length };
}

/** 銘柄に紐づく取り込み済みレポート一覧を新しい順で返す。表示用にsourceを1段joinする。 */
export async function listResearchReports(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ResearchReportSummary[]> {
  const { data, error } = await supabase
    .from("research_reports")
    .select("id, import_mode, research_date, research_model, summary, imported_at, research_sources(source_name, source_type)")
    .eq("instrument_id", instrumentId)
    .order("imported_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    importMode: row.import_mode,
    researchDate: row.research_date,
    researchModel: row.research_model,
    summary: row.summary,
    importedAt: row.imported_at,
    sourceName: row.research_sources?.source_name ?? null,
    sourceType: row.research_sources?.source_type ?? null,
  }));
}
```

- [ ] **Step 2: Write the API route**

```ts
// src/app/api/research/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { insertPasteReport, insertJsonImport } from "@/server/repositories/evidence-repository";
import { ResearchImportSchema } from "@/lib/evidence/schemas";

const sourceTypeSchema = z.enum([
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
  "official_ir",
  "edinet",
  "sec",
  "analyst",
  "investor",
  "news",
  "manual",
  "other",
]);

const pasteRequestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  mode: z.literal("paste_text"),
  sourceName: z.string().trim().min(1, "情報源の名前を入力してください。"),
  sourceType: sourceTypeSchema,
  sourceUrl: z.string().url().optional(),
  researchModel: z.string().trim().min(1).optional(),
  rawContent: z.string().trim().min(1, "本文を入力してください。"),
  userNotes: z.string().trim().min(1).optional(),
});

const jsonRequestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
  mode: z.literal("json"),
  json: z.unknown(),
});

const requestSchema = z.discriminatedUnion("mode", [pasteRequestSchema, jsonRequestSchema]);

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const instrument = await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(() => null);
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    if (parsed.data.mode === "paste_text") {
      const report = await insertPasteReport(supabase, {
        userId: user.id,
        instrumentId: instrument.id,
        sourceName: parsed.data.sourceName,
        sourceType: parsed.data.sourceType,
        sourceUrl: parsed.data.sourceUrl,
        researchModel: parsed.data.researchModel,
        rawContent: parsed.data.rawContent,
        userNotes: parsed.data.userNotes,
      });
      return NextResponse.json({ data: { reportId: report.id } });
    }

    const jsonParsed = ResearchImportSchema.safeParse(parsed.data.json);
    if (!jsonParsed.success) {
      const firstIssue = jsonParsed.error.issues[0];
      const path = firstIssue?.path.join(".");
      return apiError(
        "INVALID_REQUEST",
        path ? `JSON形式が正しくありません（${path}）: ${firstIssue?.message}` : "JSON形式が正しくありません。"
      );
    }

    const result = await insertJsonImport(supabase, user.id, instrument.id, jsonParsed.data);
    return NextResponse.json({ data: result });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
```

- [ ] **Step 3: Type-check**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit`
Expected: zero errors. If `research_sources` on the `research_reports` join in `listResearchReports` types as an array instead of a single object (Supabase's typed join inference sometimes returns `T[]` for a to-one relationship depending on how the FK is declared), adjust the mapping to `Array.isArray(row.research_sources) ? row.research_sources[0] : row.research_sources` — resolve whichever shape `tsc` actually reports, don't guess blind.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/evidence-repository.ts src/app/api/research/import/route.ts
git commit -m "feat: add research import repository and API route"
```

---

### Task 2: Research section UI on stock detail page

**Files:**
- Create: `src/components/research/ResearchImportForm.tsx`
- Create: `src/components/research/ResearchSection.tsx`
- Modify: `src/app/(dashboard)/stocks/[symbol]/page.tsx`

**Interfaces:**
- Consumes: `ResearchReportSummary`, `listResearchReports` from Task 1's `src/server/repositories/evidence-repository.ts`; `findInstrumentByProviderSymbol` from `src/server/repositories/instruments-repository.ts` (already exists); `formatDate` from `src/lib/utils/format.ts` (already exists, used elsewhere on this page).
- Produces: `<ResearchSection providerSymbol={string} reports={ResearchReportSummary[]} />` — a self-contained card; nothing later in this phase consumes it further.

- [ ] **Step 1: Write the import form**

```tsx
// src/components/research/ResearchImportForm.tsx
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
```

- [ ] **Step 2: Write the section component**

```tsx
// src/components/research/ResearchSection.tsx
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
```

- [ ] **Step 3: Wire into the stock detail page**

In `src/app/(dashboard)/stocks/[symbol]/page.tsx`:

1. Add imports near the top (with the other repository/component imports):
```ts
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { listResearchReports } from "@/server/repositories/evidence-repository";
import { ResearchSection } from "@/components/research/ResearchSection";
```
(`findInstrumentByProviderSymbol` is already imported for the manual-fund-path lookup at the top of the file — just add the two new imports.)

2. In the **manual fund branch** (the `if (manualInstrument) { ... }` block), insert directly before the closing `</div>` of the returned JSX (i.e. immediately after the existing `<ManualFundPriceHistoryForm instrumentId={manualInstrument.id} />` line):
```tsx
        <ResearchSection
          providerSymbol={manualInstrument.provider_symbol}
          reports={await listResearchReports(supabase, manualInstrument.id).catch(() => [])}
        />
```

3. In the **Yahoo-backed branch** (after the `const providerSymbol = normalizeProviderSymbol(rawSymbol);` line and after `instrument` is constructed), add a lookup for a possibly-already-existing DB row and its reports, in parallel with the existing quote/dailyPrices fetch:
```ts
  const [quote, dailyPrices, existingDbInstrument] = await Promise.all([
    provider.getQuote(providerSymbol).catch(() => null),
    provider.getDailyPrices(providerSymbol, tenYearsAgoIso(), todayIso()).catch(() => []),
    findInstrumentByProviderSymbol(supabase, providerSymbol).catch(() => null),
  ]);
  const researchReports = existingDbInstrument
    ? await listResearchReports(supabase, existingDbInstrument.id).catch(() => [])
    : [];
```
(This replaces the existing `const [quote, dailyPrices] = await Promise.all([...])` block — same two original promises, plus the new third one, and the derived `researchReports` line right after.)

4. Insert directly before the closing `</div>` of the Yahoo-branch's returned JSX (i.e. immediately after the existing `指標` block's closing `</div>`):
```tsx
      <ResearchSection providerSymbol={instrument.providerSymbol} reports={researchReports} />
```

- [ ] **Step 4: Type-check**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manual browser verification**

This is a UI change — per project convention, verify it actually works in a browser before considering the task done (do not rely on `tsc`/build success alone):

1. Start the dev server for this worktree: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npm run dev -- -p 3010` (use a port other than the project's standard 3006, since this is a worktree running alongside a possible main checkout).
2. Open a stock detail page for any real symbol (e.g. a Japanese stock already in the app, or any valid Yahoo ticker) in a browser.
3. Confirm the new "リサーチ" section renders with "資料を追加" button and the empty-state message.
4. Click "資料を追加", switch between "貼り付け" and "JSON" tabs, confirm both render their respective fields.
5. Submit a paste-mode entry with a source name and short body text; confirm it appears in the list after the page refreshes, with correct source-type badge and date.
6. Submit a JSON-mode entry using a small valid `ResearchImportSchema` payload (e.g. the minimal example from `tests/unit/evidence-schemas.test.ts`); confirm it appears in the list too.
7. Submit an invalid JSON payload (e.g. missing `company.ticker`); confirm the error message surfaces in the form instead of a blank failure or a crashed page.
8. Stop the dev server.

Record what you observed (screenshots not required, but describe pass/fail for each of steps 3–7) in your report.

- [ ] **Step 6: Commit**

```bash
git add src/components/research/ResearchImportForm.tsx src/components/research/ResearchSection.tsx "src/app/(dashboard)/stocks/[symbol]/page.tsx"
git commit -m "feat: add research import UI to stock detail page"
```

---

## Definition of Done for Phase P2

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` still passes (this phase adds no new test files, but must not break the 62 existing tests).
- [ ] Manual browser verification (Task 2 Step 5) completed and reported, both paste and JSON import paths confirmed working end-to-end against the live (already-applied, per user confirmation) Phase P1 schema.
- [ ] No existing route, repository, or component outside the files listed above was modified.

## What's Deliberately Not in This Phase

No manual-metrics-only form (P3), no Evidence Builder (P4), no scoring (P5), no Cloudflare AI (P6), no R2/file upload, no tab restructuring of the stock detail page (still a single scroll page — the Research section is appended, not a new tab), no dedicated Dialog/Drawer primitive (the import form is an inline expand/collapse card, matching this codebase's only existing form pattern).
