# Investment Intelligence — Phase P3: Manual Financial Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type in financial metrics by hand (revenue, ROE, PER, etc., for a specific fiscal period) directly on the stock detail page's existing "決算・財務" (Financials) tab, persisted as `financial_metrics` rows with `is_manual = true`. Replace that tab's current unconditional `UnavailableResearchPanel` placeholder with real data once any metrics exist (manually entered, or already imported via Phase P2's JSON import), while still showing the "not connected" message only when truly empty.

**Architecture:** One new repository function pair (`insertManualMetric`, `listFinancialMetrics`) added to Phase P2's existing `src/server/repositories/evidence-repository.ts`, one new POST route, one new form + list component, wired into the "決算・財務" tab slot Phase P2 discovered already exists in `src/app/(dashboard)/stocks/[symbol]/page.tsx` (both the manual-fund and Yahoo-backed branches — Phase P2's tab-integration pattern applies identically here).

**Tech Stack:** Same as P1/P2 — Next.js 14 App Router, Supabase, Zod, TanStack Query `useMutation`. Builds on P1's `financial_metrics` table and `MetricKey` union (`src/types/evidence.ts`).

## Global Constraints

- A manual metric entry does **not** create a `research_reports` or `research_sources` row — `financial_metrics.source_id` and `source_report_id` are both `null` for manually entered rows (there is no "report" being imported, just a typed-in number). Only `is_manual: true` marks it.
- New DB writes always resolve `instruments.id` server-side via the exact two-step lookup Phase P2 established in `src/app/api/research/import/route.ts` (`findInstrumentByProviderSymbol(..., "manual")` first, fall back to `resolveOrCreateInstrument`) — copy that pattern exactly, since a manual-fund symbol has the same case-sensitive/provider-mismatch problem here.
- `metric_key` must be validated against the `MetricKey` union (`src/types/evidence.ts`) via Zod `z.enum(metricKeyValues)` — reuse `metricKeyValues` already exported from `src/lib/evidence/schemas.ts` (do not redeclare the list a third time).
- Per P1's Global Constraint (still binding): `missing != 0` — value is a required field with no default; do not coerce a blank/invalid input to `0`.
- All new API-route Zod schemas live inline at the top of the route file, matching every existing route.
- All new Supabase writes go through the user-scoped client (`createClient()`), never the service-role client (except the already-existing exception inside `resolveOrCreateInstrument` for the shared `instruments` table, reused unchanged).
- Bulk/array `.insert()` calls (there are none needed in this phase — a manual entry is always a single row) do not need `{ defaultToNull: false }`; single-row inserts are unaffected by the PostgREST quirk documented in `evidence-repository.ts` (see its top-of-file comment) — no action needed here, just don't introduce an array insert without it if a future step batches entries.
- Every new component uses the existing design tokens only, matching `ResearchImportForm.tsx`'s form-field styling (`rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus`) and `AnalyticsPanel` for panel framing (already used throughout `stocks/[symbol]/page.tsx` for the tab contents Codex built).
- `apiError(code, message?)` for failures; `NextResponse.json({ data: ... })` for success.
- After every code step: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit` must pass with zero errors.
- This codebase has no route/repository unit tests anywhere — match existing convention (type-check only for these files).
- Work happens in the existing worktree/branch (`feature/investment-intelligence-p1`), continuing directly on top of P2's commits. Do not create a new worktree or branch.
- **Before claiming this phase done, perform live manual browser verification** against the actual dev server (`npm run dev --prefix <worktree path> -- -p 3010`, or reuse the `stockscope-p2-worktree` launch config already added to `C:\Users\takas\claude_code\.claude\launch.json`) and the actual Supabase project — Phase P2 found two real bugs (a 404 on manual-fund symbols, and a PostgREST default-bypass NULL constraint violation) that only live testing caught; static review alone was not sufficient. **Clean up any test data written to the live database afterward** (Phase P2 established the pattern: query by `instrument_id`, delete from the affected table(s), verify counts).

---

### Task 1: Manual metric repository + API route

**Files:**
- Modify: `src/server/repositories/evidence-repository.ts` (add two functions; do not touch the existing `insertPasteReport`/`insertJsonImport`/`listResearchReports`)
- Create: `src/app/api/research/metrics/route.ts`

**Interfaces:**
- Consumes: `metricKeyValues` (export it from `src/lib/evidence/schemas.ts` if not already exported — check first, it may already be a module-local `const`; if so, add `export` to its declaration, which is a one-line change and does not affect any existing behavior), `MetricKey` from `src/types/evidence.ts`, `resolveOrCreateInstrument`, `findInstrumentByProviderSymbol`, `apiError`, `createClient`.
- Produces: `insertManualMetric(supabase, params)`, `listFinancialMetrics(supabase, instrumentId)` — consumed by Task 2's UI and page wiring.

- [ ] **Step 1: Check whether `metricKeyValues` is exported**

Read `src/lib/evidence/schemas.ts`. If the line reads `const metricKeyValues: [MetricKey, ...MetricKey[]] = [`, change it to `export const metricKeyValues: [MetricKey, ...MetricKey[]] = [` (add the `export` keyword only — do not change the array contents). If it is already exported, skip this step.

- [ ] **Step 2: Add the repository functions**

Append to `src/server/repositories/evidence-repository.ts` (after the existing `listResearchReports` function, at the end of the file):

```ts
type FinancialMetricRow = Database["public"]["Tables"]["financial_metrics"]["Row"];

export interface InsertManualMetricParams {
  userId: string;
  instrumentId: string;
  metricKey: FinancialMetricRow["metric_key"];
  value: number;
  unit?: string;
  currency?: "JPY" | "USD";
  periodType: "FY" | "Q";
  periodStart: string;
  periodEnd: string;
  reportedAt?: string;
}

/** 手入力の財務指標を1件保存する。source_id/source_report_idは常にnull（インポートされたレポートに由来しないため）。 */
export async function insertManualMetric(
  supabase: SupabaseClient<Database>,
  params: InsertManualMetricParams
): Promise<FinancialMetricRow> {
  const { data, error } = await supabase
    .from("financial_metrics")
    .insert({
      user_id: params.userId,
      instrument_id: params.instrumentId,
      metric_key: params.metricKey,
      value: params.value,
      unit: params.unit,
      currency: params.currency,
      period_type: params.periodType,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      reported_at: params.reportedAt,
      is_manual: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** 銘柄に紐づく財務指標を期間の新しい順で返す（手入力・インポート両方を含む）。 */
export async function listFinancialMetrics(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<FinancialMetricRow[]> {
  const { data, error } = await supabase
    .from("financial_metrics")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("period_end", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: Write the API route**

```ts
// src/app/api/research/metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { insertManualMetric } from "@/server/repositories/evidence-repository";
import { metricKeyValues } from "@/lib/evidence/schemas";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((value) => {
    const parts = value.split("-").map(Number);
    const year = parts[0] ?? NaN;
    const month = parts[1] ?? NaN;
    const day = parts[2] ?? NaN;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "date must be a real calendar date");

const requestSchema = z
  .object({
    providerSymbol: z.string().trim().min(1),
    metricKey: z.enum(metricKeyValues),
    value: z.number().finite("有効な数値を入力してください。"),
    unit: z.string().trim().min(1).optional(),
    currency: z.enum(["JPY", "USD"]).optional(),
    periodType: z.enum(["FY", "Q"]),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    reportedAt: isoDateSchema.optional(),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "期間終了日は開始日より前にできません。",
    path: ["periodEnd"],
  });

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  const manualInstrument = await findInstrumentByProviderSymbol(
    supabase,
    parsed.data.providerSymbol,
    "manual"
  ).catch(() => null);
  const instrument =
    manualInstrument ?? (await resolveOrCreateInstrument(parsed.data.providerSymbol).catch(() => null));
  if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

  try {
    const metric = await insertManualMetric(supabase, {
      userId: user.id,
      instrumentId: instrument.id,
      metricKey: parsed.data.metricKey,
      value: parsed.data.value,
      unit: parsed.data.unit,
      currency: parsed.data.currency,
      periodType: parsed.data.periodType,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      reportedAt: parsed.data.reportedAt,
    });
    return NextResponse.json({ data: { metricId: metric.id } });
  } catch {
    return apiError("INTERNAL_ERROR");
  }
}
```

- [ ] **Step 4: Type-check**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/evidence-repository.ts src/app/api/research/metrics/route.ts src/lib/evidence/schemas.ts
git commit -m "feat: add manual financial metric repository and API route"
```

---

### Task 2: Manual metrics UI on the 決算・財務 tab

**Files:**
- Create: `src/components/research/ManualMetricForm.tsx`
- Create: `src/components/research/FinancialMetricsPanel.tsx`
- Modify: `src/app/(dashboard)/stocks/[symbol]/page.tsx`

**Interfaces:**
- Consumes: `listFinancialMetrics` from Task 1; `MetricKey` from `src/types/evidence.ts`; `Database["public"]["Tables"]["financial_metrics"]["Row"]` from `src/types/supabase.ts`; existing `AnalyticsPanel` (`src/components/ui/AnalyticsPanel.tsx`) and `formatDate` (`src/lib/utils/format.ts`).
- Produces: `<FinancialMetricsPanel providerSymbol={string} metrics={FinancialMetricRow[]} />` — replaces the current `UnavailableResearchPanel` content of the "決算・財務" tab entry.

- [ ] **Step 1: Write the metric key label map and the entry form**

```tsx
// src/components/research/ManualMetricForm.tsx
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
```

- [ ] **Step 2: Write the panel that lists metrics and hosts the form**

```tsx
// src/components/research/FinancialMetricsPanel.tsx
"use client";

import type { Database } from "@/types/supabase";
import { AnalyticsPanel } from "@/components/ui/AnalyticsPanel";
import { ManualMetricForm, METRIC_KEY_LABEL } from "./ManualMetricForm";
import { formatDate } from "@/lib/utils/format";

type FinancialMetricRow = Database["public"]["Tables"]["financial_metrics"]["Row"];

function formatPeriod(row: FinancialMetricRow): string {
  const label = row.period_type === "FY" ? "通期" : "四半期";
  return `${label} ${formatDate(row.period_start)} 〜 ${formatDate(row.period_end)}`;
}

export function FinancialMetricsPanel({
  providerSymbol,
  metrics,
}: {
  providerSymbol: string;
  metrics: FinancialMetricRow[];
}) {
  return (
    <div className="space-y-4">
      <AnalyticsPanel title="決算・財務">
        {metrics.length === 0 ? (
          <>
            <p className="text-sm font-semibold text-text-primary">実データはまだ接続されていません</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              決算書と財務指標の実データは未接続です。下のフォームから手入力するか、リサーチタブからJSON取り込みで登録できます。
            </p>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="py-2 pr-4">指標</th>
                  <th className="py-2 pr-4">値</th>
                  <th className="py-2 pr-4">対象期間</th>
                  <th className="py-2 pr-4">出所</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-semibold text-text-primary">
                      {METRIC_KEY_LABEL[row.metric_key as keyof typeof METRIC_KEY_LABEL] ?? row.metric_key}
                    </td>
                    <td className="py-2 pr-4 text-text-primary">
                      {row.value}
                      {row.unit === "percent" ? "%" : ""}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{formatPeriod(row)}</td>
                    <td className="py-2 pr-4 text-text-muted">{row.is_manual ? "手入力" : "インポート"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel title="指標を手入力">
        <ManualMetricForm providerSymbol={providerSymbol} />
      </AnalyticsPanel>
    </div>
  );
}
```

- [ ] **Step 3: Wire into the stock detail page**

In `src/app/(dashboard)/stocks/[symbol]/page.tsx`:

1. Add imports:
```ts
import { listFinancialMetrics } from "@/server/repositories/evidence-repository";
import { FinancialMetricsPanel } from "@/components/research/FinancialMetricsPanel";
```

2. In the manual-fund branch, add a third promise to the existing `Promise.all` (from Phase P2) and pass the result to a new "決算・財務" tab entry. Replace:
```ts
    const [priceHistory, manualResearchReports] = await Promise.all([
      listManualFundPrices(supabase, manualInstrument.id).catch(() => []),
      listResearchReports(supabase, manualInstrument.id).catch(() => []),
    ]);
```
with:
```ts
    const [priceHistory, manualResearchReports, manualFinancialMetrics] = await Promise.all([
      listManualFundPrices(supabase, manualInstrument.id).catch(() => []),
      listResearchReports(supabase, manualInstrument.id).catch(() => []),
      listFinancialMetrics(supabase, manualInstrument.id).catch(() => []),
    ]);
```
Then add a new tab entry to that branch's `InstrumentDetailTabs` `tabs` array (insert it anywhere sensible, e.g. right after the `"evidence"` tab and before the `"research"` tab Phase P2 added):
```tsx
            {
              id: "financials",
              label: "決算・財務",
              content: (
                <FinancialMetricsPanel
                  providerSymbol={manualInstrument.provider_symbol}
                  metrics={manualFinancialMetrics}
                />
              ),
            },
```

3. In the Yahoo-backed branch, add a fourth promise to the existing `Promise.all` (from Phase P2). Replace:
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
with:
```ts
  const [quote, dailyPrices, existingDbInstrument] = await Promise.all([
    provider.getQuote(providerSymbol).catch(() => null),
    provider.getDailyPrices(providerSymbol, tenYearsAgoIso(), todayIso()).catch(() => []),
    findInstrumentByProviderSymbol(supabase, providerSymbol).catch(() => null),
  ]);
  const [researchReports, financialMetrics] = existingDbInstrument
    ? await Promise.all([
        listResearchReports(supabase, existingDbInstrument.id).catch(() => []),
        listFinancialMetrics(supabase, existingDbInstrument.id).catch(() => []),
      ])
    : [[], []];
```
Then **replace** the existing hardcoded `"financials"` tab entry (currently `content: <UnavailableResearchPanel title="決算・財務" .../>`) with:
```tsx
          {
            id: "financials",
            label: "決算・財務",
            content: (
              <FinancialMetricsPanel providerSymbol={instrument.providerSymbol} metrics={financialMetrics} />
            ),
          },
```
(Keep its position in the `tabs` array exactly where it already is — do not reorder other tabs.)

- [ ] **Step 4: Type-check**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit`
Expected: zero errors. If `existingDbInstrument ? await Promise.all([...]) : [[], []]` doesn't infer the tuple type cleanly, annotate explicitly: `: Promise<[ResearchReportSummary[], FinancialMetricRow[]]>` is not needed if you instead write `[[] as typeof researchReportsResult, [] as typeof financialMetricsResult]` — resolve whichever way `tsc` accepts without `any`; do not silence the error with a type assertion that defeats the purpose of type-checking.

- [ ] **Step 5: Manual browser verification**

Per this plan's Global Constraints, live-verify before considering this phase done:

1. Start the dev server (`stockscope-p2-worktree` launch config, port 3010, or `npm run dev --prefix C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 -- -p 3010`).
2. Navigate to a Yahoo-backed stock detail page, open the "決算・財務" tab. Confirm it shows the "not connected" placeholder (empty state) plus the manual-entry form below it, when no metrics exist yet.
3. Submit a manual metric (any metric key, a numeric value, a period). Confirm it appears in the table after refresh, with "手入力" in the 出所 column.
4. Submit an invalid value (leave it blank, or type non-numeric text) — confirm the client-side check blocks submission with a clear error, not a raw network error.
5. Navigate to a manual-fund detail page (e.g. `/stocks/MANUAL:<slug>` — find a real one via a DB query if needed, the same way Phase P2's fix was verified), open its "決算・財務" tab, submit a metric there too — this exercises the manual-instrument-resolution code path this plan's Global Constraints called out as a known risk area (Phase P2 found a real bug here; this phase reuses the same resolution logic in a new route, so it must be verified independently, not assumed fixed by association).
6. **Delete all test rows you created** from `financial_metrics` in the live Supabase project afterward (query by `instrument_id`, confirm deletion count matches what you inserted).
7. Stop the dev server.

Report what you observed for each step.

- [ ] **Step 6: Commit**

```bash
git add src/components/research/ManualMetricForm.tsx src/components/research/FinancialMetricsPanel.tsx "src/app/(dashboard)/stocks/[symbol]/page.tsx"
git commit -m "feat: add manual financial metrics UI to the stock detail page"
```

---

## Definition of Done for Phase P3

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` still passes all existing tests (this phase adds no new automated tests, matching repo convention).
- [ ] Live browser verification completed for BOTH the Yahoo-backed and manual-fund instrument-resolution paths, and reported.
- [ ] Test data cleaned up from the live database.
- [ ] No existing route, repository, or component outside the files listed above was modified, except the documented `financial_metrics` tab replacement and `Promise.all` extensions in `stocks/[symbol]/page.tsx`.

## What's Deliberately Not in This Phase

No CSV/bulk manual-metrics import (only single-entry-at-a-time via the form), no computed/derived metrics (revenue growth YoY, etc. — that's Phase P5's Evidence Builder/scoring concern), no editing or deleting existing metric rows (append-only, matching the `financial_metrics` table's documented append-only design from Phase P1), no "決算・財務" tab redesign beyond swapping its content source from hardcoded placeholder to real data.
