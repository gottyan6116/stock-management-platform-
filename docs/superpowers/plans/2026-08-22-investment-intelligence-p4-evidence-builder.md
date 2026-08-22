# Investment Intelligence — Phase P4: Evidence Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble everything known about one instrument (market snapshot, financials, management statements, catalysts, risks, events, investor opinions, imported research) into one structured `InvestmentEvidence` packet, plus a `DataCoverage` summary showing which categories actually have data. This is the shape Phase P5 (quant scoring) and Phase P6 (Cloudflare AI) will both consume. No UI, no new writes — pure aggregation of what P1–P3 already store.

**Architecture:** Two layers, deliberately separated for testability: (1) thin repository read functions (DB I/O, one per remaining evidence table — `management_statements`, `company_catalysts`, `company_risks`, `company_events`, `research_opinions` — the only five tables from Phase P1's schema that still have no read function; `financial_metrics` and `research_reports` already have `listFinancialMetrics`/`listResearchReports` from P2/P3), and (2) a **pure** builder function (`buildInvestmentEvidence`) that takes already-fetched data as plain arguments and returns the assembled packet — no Supabase client, no network call, so it can be unit-tested like Phase P1's Zod schemas (this codebase currently has zero tests for anything DB/route-shaped, by established convention — but this layer is pure, so it should be tested, matching the standard already set for `src/lib/evidence/schemas.ts`).

**Tech Stack:** Same as P1–P3. No new dependencies.

## Global Constraints

- The builder function itself performs **no I/O** — it is `(input: BuildEvidenceInput) => InvestmentEvidence`, fully synchronous, fully testable with plain objects. Fetching the data it consumes is the caller's job (Phase P6 will be that caller).
- Repository read functions return raw `Database["public"]["Tables"][...]["Row"]` types (matching the established precedent from `listFinancialMetrics` in Phase P3, not the camelCase domain types) — the builder itself does the snake_case → camelCase mapping into `InvestmentEvidence`'s shape, keeping the repository layer thin and consistent with every existing repository function in this codebase.
- Every repository read function filters by `instrument_id` only (RLS is the access-control boundary) and orders by a real, ties-safe column — Phase P3's review found `listFinancialMetrics` originally had a non-deterministic sort under ties; every new function here must include a deterministic secondary sort key from the start (e.g. `created_at desc`), not add it later as a fix.
- `DataCoverage` must never fabricate a false positive: `missing != 0` still applies — a category with zero rows must report a coverage value that clearly means "no data" (`0`), never a placeholder that could be misread as "fully covered."
- Reuse existing camelCase domain types from `src/types/evidence.ts` (`ManagementStatement`, `CompanyCatalyst`, `CompanyRisk`, `CompanyEvent`, `ResearchOpinion`, `FinancialMetric`) for `InvestmentEvidence`'s fields — do not redeclare shapes that already exist.
- After every code step: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit` must pass with zero errors.
- Work happens in the existing worktree/branch (`feature/investment-intelligence-p1`), continuing directly on top of P3's commits. Do not create a new worktree or branch.
- This phase does not require live browser verification (no UI, no new writes) — but the new repository read functions should be exercised via a quick Node script against the live Supabase project (the same technique used in Phases P2/P3) to confirm they compile and query correctly against the real schema, since `tsc`/`vitest` alone cannot catch a wrong column name or a malformed `.select()` string. Clean up any test data inserted for this check.

---

### Task 1: Repository read functions for the remaining five evidence tables

**Files:**
- Modify: `src/server/repositories/evidence-repository.ts` (append only — do not touch any existing function)

**Interfaces:**
- Consumes: `Database` from `src/types/supabase.ts` (already has full `Row` types for all five tables from Phase P1).
- Produces: `listManagementStatements`, `listCompanyCatalysts`, `listCompanyRisks`, `listCompanyEvents`, `listResearchOpinions` — consumed by Task 2's builder (via its caller, since the builder itself takes plain data, not a Supabase client).

- [ ] **Step 1: Append the five read functions**

```ts
type ManagementStatementRow = Database["public"]["Tables"]["management_statements"]["Row"];
type CompanyCatalystRow = Database["public"]["Tables"]["company_catalysts"]["Row"];
type CompanyRiskRow = Database["public"]["Tables"]["company_risks"]["Row"];
type CompanyEventRow = Database["public"]["Tables"]["company_events"]["Row"];
type ResearchOpinionRow = Database["public"]["Tables"]["research_opinions"]["Row"];

/** 銘柄に紐づく経営者・投資家発言を発言日の新しい順で返す（発言日未設定はcreated_atで補完）。 */
export async function listManagementStatements(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ManagementStatementRow[]> {
  const { data, error } = await supabase
    .from("management_statements")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("statement_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくカタリスト（好材料）を登録日の新しい順で返す。 */
export async function listCompanyCatalysts(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyCatalystRow[]> {
  const { data, error } = await supabase
    .from("company_catalysts")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくリスクを検知日の新しい順で返す（検知日未設定はcreated_atで補完）。 */
export async function listCompanyRisks(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyRiskRow[]> {
  const { data, error } = await supabase
    .from("company_risks")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("detected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づくイベント（決算・M&A等）をイベント日の新しい順で返す。 */
export async function listCompanyEvents(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<CompanyEventRow[]> {
  const { data, error } = await supabase
    .from("company_events")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** 銘柄に紐づく投資家・アナリスト意見を公表日の新しい順で返す（公表日未設定はcreated_atで補完）。 */
export async function listResearchOpinions(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<ResearchOpinionRow[]> {
  const { data, error } = await supabase
    .from("research_opinions")
    .select("*")
    .eq("instrument_id", instrumentId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Type-check**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit`
Expected: zero errors. If `.order(..., { nullsFirst: false })` isn't accepted by the installed `@supabase/postgrest-js` version's types, check the actual accepted option shape by reading `node_modules/@supabase/postgrest-js`'s type definitions for `.order()` and adjust to whatever it actually accepts — do not silently drop the null-ordering intent (a null `statement_date`/`detected_at`/`published_at` should sort after real dates, not before, so the most-recently-known-dated evidence appears first).

- [ ] **Step 3: Live smoke-test against the real schema**

Write a throwaway Node script (same pattern used in Phases P2/P3 — read `.env.local`, construct a service-role Supabase client) that calls each of the five new functions against a real `instrument_id` from the `instruments` table, confirms each returns without error (empty array is fine — the tables are likely empty), then delete the script. This is not a full data-insertion test — just confirming the `.select()`/`.order()` calls are valid against the live schema (column names, no typos) since `tsc` cannot catch a string literal mismatch against actual Postgres column names.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/evidence-repository.ts
git commit -m "feat: add repository read functions for remaining evidence tables"
```

---

### Task 2: Evidence types + pure builder + unit tests

**Files:**
- Create: `src/lib/evidence/builder.ts`
- Test: `tests/unit/evidence-builder.test.ts`

**Interfaces:**
- Consumes: `ManagementStatement`, `CompanyCatalyst`, `CompanyRisk`, `CompanyEvent`, `ResearchOpinion`, `FinancialMetric` domain types from `src/types/evidence.ts`; `ResearchReportSummary` from `src/server/repositories/evidence-repository.ts`.
- Produces: `CompanySnapshot`, `MarketSnapshot`, `DataCoverage`, `InvestmentEvidence` types, `buildInvestmentEvidence(input: BuildEvidenceInput): InvestmentEvidence` — the shape Phase P5 (scoring) and Phase P6 (Cloudflare AI evidence packet) will both import and use.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/evidence-builder.test.ts
import { describe, expect, it } from "vitest";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";

const company: CompanySnapshot = {
  instrumentId: "inst-1",
  providerSymbol: "6758.T",
  name: "Sony Group Corporation",
  exchange: "Tokyo",
  market: "JP",
  currency: "JPY",
  sector: null,
  industry: null,
};

const market: MarketSnapshot = {
  priceDate: "2026-08-20",
  close: 3785,
  previousClose: 3777,
  change: 8,
  changePercent: 0.21,
  dividendYield: 0.93,
  trailingPE: 20.29,
  marketCap: null,
};

function emptyEvidenceInputs() {
  return {
    company,
    market,
    financials: [],
    managementStatements: [],
    catalysts: [],
    risks: [],
    events: [],
    opinions: [],
    research: [],
  };
}

describe("buildInvestmentEvidence", () => {
  it("assembles a packet with all input arrays passed through unchanged", () => {
    const financials = [
      {
        id: "m1",
        instrumentId: "inst-1",
        metricKey: "roe" as const,
        value: 15.2,
        unit: null,
        currency: null,
        periodType: "FY" as const,
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
        reportedAt: null,
        sourceId: null,
        sourceReportId: null,
        isManual: true,
        createdAt: "2026-08-20T00:00:00Z",
      },
    ];
    const evidence = buildInvestmentEvidence({ ...emptyEvidenceInputs(), financials });
    expect(evidence.financials).toBe(financials);
    expect(evidence.company).toEqual(company);
    expect(evidence.market).toEqual(market);
  });

  it("sets generatedAt to a valid ISO timestamp", () => {
    const evidence = buildInvestmentEvidence(emptyEvidenceInputs());
    expect(() => new Date(evidence.generatedAt).toISOString()).not.toThrow();
  });

  it("reports zero coverage for every category when all inputs are empty", () => {
    const evidence = buildInvestmentEvidence(emptyEvidenceInputs());
    expect(evidence.dataCoverage).toEqual({
      financials: 0,
      management: 0,
      risks: 0,
      events: 0,
      opinions: 0,
      research: 0,
      overall: 0,
    });
  });

  it("reports full coverage for a category with at least one entry, without inflating others", () => {
    const evidence = buildInvestmentEvidence({
      ...emptyEvidenceInputs(),
      risks: [
        {
          id: "r1",
          instrumentId: "inst-1",
          riskType: "fx",
          description: "Yen risk",
          severity: "medium",
          likelihood: null,
          sourceId: null,
          detectedAt: null,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
    });
    expect(evidence.dataCoverage.risks).toBe(1);
    expect(evidence.dataCoverage.financials).toBe(0);
    expect(evidence.dataCoverage.overall).toBeCloseTo(1 / 6, 5);
  });

  it("computes overall coverage as the mean of the six category scores", () => {
    const evidence = buildInvestmentEvidence({
      ...emptyEvidenceInputs(),
      financials: [
        {
          id: "m1",
          instrumentId: "inst-1",
          metricKey: "revenue" as const,
          value: 100,
          unit: null,
          currency: "JPY" as const,
          periodType: "FY" as const,
          periodStart: "2025-04-01",
          periodEnd: "2026-03-31",
          reportedAt: null,
          sourceId: null,
          sourceReportId: null,
          isManual: true,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
      events: [
        {
          id: "e1",
          instrumentId: "inst-1",
          eventType: "earnings" as const,
          title: "Q2 results",
          description: null,
          eventDate: "2026-08-05",
          sourceId: null,
          sourceReportId: null,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
    });
    expect(evidence.dataCoverage.financials).toBe(1);
    expect(evidence.dataCoverage.events).toBe(1);
    expect(evidence.dataCoverage.management).toBe(0);
    expect(evidence.dataCoverage.overall).toBeCloseTo(2 / 6, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/evidence-builder.test.ts`
Expected: FAIL — `Cannot find module '@/lib/evidence/builder'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/evidence/builder.ts
import type {
  CompanyCatalyst,
  CompanyEvent,
  CompanyRisk,
  FinancialMetric,
  ManagementStatement,
  ResearchOpinion,
} from "@/types/evidence";
import type { ResearchReportSummary } from "@/server/repositories/evidence-repository";
import type { Market, Currency } from "@/types/domain";

export interface CompanySnapshot {
  instrumentId: string;
  providerSymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  sector: string | null;
  industry: string | null;
}

export interface MarketSnapshot {
  priceDate: string | null;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  trailingPE: number | null;
  marketCap: number | null;
}

export interface DataCoverage {
  financials: number;
  management: number;
  risks: number;
  events: number;
  opinions: number;
  research: number;
  overall: number;
}

export interface InvestmentEvidence {
  company: CompanySnapshot;
  market: MarketSnapshot;
  financials: FinancialMetric[];
  managementStatements: ManagementStatement[];
  catalysts: CompanyCatalyst[];
  risks: CompanyRisk[];
  events: CompanyEvent[];
  opinions: ResearchOpinion[];
  research: ResearchReportSummary[];
  dataCoverage: DataCoverage;
  generatedAt: string;
}

export interface BuildEvidenceInput {
  company: CompanySnapshot;
  market: MarketSnapshot;
  financials: FinancialMetric[];
  managementStatements: ManagementStatement[];
  catalysts: CompanyCatalyst[];
  risks: CompanyRisk[];
  events: CompanyEvent[];
  opinions: ResearchOpinion[];
  research: ResearchReportSummary[];
}

function coverageOf(count: number): number {
  return count > 0 ? 1 : 0;
}

/**
 * 各カテゴリの「データがあるかどうか」を0/1で示す単純なカバレッジ指標。
 * 将来的に件数や新しさで重み付けする場合もこの関数の戻り値の意味（missing=0）は変えないこと。
 */
function computeDataCoverage(input: BuildEvidenceInput): DataCoverage {
  const financials = coverageOf(input.financials.length);
  const management = coverageOf(input.managementStatements.length);
  const risks = coverageOf(input.risks.length);
  const events = coverageOf(input.events.length);
  const opinions = coverageOf(input.opinions.length);
  const research = coverageOf(input.research.length);
  const overall = (financials + management + risks + events + opinions + research) / 6;
  return { financials, management, risks, events, opinions, research, overall };
}

/** 銘柄1件分の全evidenceを1つのパケットに組み立てる純粋関数。DBアクセスは呼び出し側の責務。 */
export function buildInvestmentEvidence(input: BuildEvidenceInput): InvestmentEvidence {
  return {
    company: input.company,
    market: input.market,
    financials: input.financials,
    managementStatements: input.managementStatements,
    catalysts: input.catalysts,
    risks: input.risks,
    events: input.events,
    opinions: input.opinions,
    research: input.research,
    dataCoverage: computeDataCoverage(input),
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/evidence-builder.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Type-check and full suite**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, all tests passing (139 existing + 5 new = 144).

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidence/builder.ts tests/unit/evidence-builder.test.ts
git commit -m "feat: add pure Evidence Builder assembling InvestmentEvidence packets"
```

---

## Definition of Done for Phase P4

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` passes with zero failures (144 tests: 139 existing + 5 new).
- [ ] The five new repository functions were smoke-tested against the live Supabase project and confirmed to query without error; any test data was cleaned up.
- [ ] No existing file outside `evidence-repository.ts` (append-only) was modified.

## What's Deliberately Not in This Phase

No orchestration function that fetches everything and calls the builder in one call (that's Phase P6's job, once there's an actual consumer — building it now with no caller would be premature). No UI. No scoring logic (Phase P5). No AI calls (Phase P6).
