# Investment Intelligence — Phase P1: Evidence DB Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase schema, generated TypeScript types, domain types, and Zod validation schemas for the Investment Intelligence "Evidence Database" — the structured, provenance-tracked storage layer that later phases (Research Import UI, Quant Scoring, Cloudflare AI Analysis) build on. This phase adds no UI and no API routes; it only makes the data layer exist and be typed/validated correctly.

**Architecture:** Purely additive. Nine new tables under `public`, each owned by `user_id` with RLS `for all using/with check (auth.uid() = user_id)` — the exact pattern already proven in `0005_simulation.sql` (works correctly under the new Supabase publishable/secret API-key auth mode, unlike the `to authenticated` role-based policies that were fixed in `0003_fix_shared_table_rls.sql`). No existing table, route, or component is touched.

**Tech Stack:** Supabase Postgres (hand-written migration SQL, no Supabase CLI codegen — this repo has none configured), hand-written `Database` type in `src/types/supabase.ts` (same pattern as existing tables), Zod ^3.23.8, Vitest.

## Global Constraints

- Every new table has a `user_id uuid not null references auth.users(id) on delete cascade` column and RLS enabled with `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` — never `to authenticated` (proven broken under this project's auth mode, see `0003_fix_shared_table_rls.sql`).
- Every evidence table that stores a claim/fact links back to its provenance via `source_id uuid references public.research_sources(id)` (nullable — manual entries may have no external source) and, where the fact came from an imported report, `source_report_id uuid references public.research_reports(id)` (nullable).
- All new tables use `id uuid primary key default gen_random_uuid()` except none reuse an existing table's PK pattern (no natural keys here, unlike `daily_prices`).
- `instrument_id uuid not null references public.instruments(id) on delete cascade` on every evidence table (this app's evidence is always scoped to one tracked instrument).
- `missing != 0`: no column gets a numeric default of `0` for evidence values; all optional numerics are nullable with no default.
- Money/percent-like values stored as `numeric`, never `float`/`real` (matches existing `positions.avg_cost`, `simulation_trades.price`).
- Follow this repo's existing migration file header comment style (Japanese, explains *why*, see `0005_simulation.sql`'s header).
- After every code step: `cd C:\Users\takas\dev\stockscope && npx tsc --noEmit` must pass with zero errors (per project CLAUDE.md).
- Migrations are **applied manually via the Supabase SQL Editor** in this project (see `README.md`) — I cannot run them against production. Each SQL task ends with a note to the user, not a `psql`/`supabase db push` command.

---

### Task 1: Evidence schema migration

**Files:**
- Create: `supabase/migrations/0007_evidence_schema.sql`

**Interfaces:**
- Produces: tables `research_sources`, `research_reports`, `financial_metrics`, `management_statements`, `research_opinions`, `company_events`, `company_risks`, `company_catalysts`, `analysis_runs` — exact column sets below, consumed by Task 2 (TS types) and all later phases.

- [ ] **Step 1: Write the migration file**

```sql
-- 0007: Investment Intelligence — Evidence DB
-- 外部AI（ChatGPT/Claude/Gemini/Perplexity等）やIR資料から調査した情報を
-- 構造化して保存する。Research AI（情報収集）と Cloudflare AI（最終分析）を分離する
-- Import-First アーキテクチャの土台（docs/spec/investment_intelligence_import_first_spec.md）。
-- すべてのテーブルは user_id で所有者分離し、RLSは0005と同じ auth.uid() = user_id パターンを使う
-- （0003で判明した通り、新しいAPIキー認証モードでは `to authenticated` ロールベースのポリシーは
--  黙って0件を返すため使わない）。

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'chatgpt', 'claude', 'gemini', 'perplexity', 'official_ir', 'edinet',
      'sec', 'analyst', 'investor', 'news', 'manual', 'other'
    )
  ),
  source_name text not null,
  source_url text,
  evidence_class text not null default 'fact' check (evidence_class in ('fact', 'opinion', 'ai_interpretation')),
  reliability text check (reliability in ('low', 'medium', 'high')),
  researched_at date,
  created_at timestamptz not null default now()
);

create index if not exists research_sources_user_instrument_idx
  on public.research_sources (user_id, instrument_id);

alter table public.research_sources enable row level security;
create policy "users manage own research sources"
on public.research_sources for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  source_id uuid references public.research_sources(id) on delete set null,
  import_mode text not null check (import_mode in ('paste_text', 'json', 'manual_form')),
  research_date date,
  original_query text,
  research_model text,
  raw_content text not null,
  structured_json jsonb,
  summary text,
  user_notes text,
  imported_at timestamptz not null default now()
);

create index if not exists research_reports_user_instrument_idx
  on public.research_reports (user_id, instrument_id);

alter table public.research_reports enable row level security;
create policy "users manage own research reports"
on public.research_reports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  metric_key text not null,
  value numeric not null,
  unit text,
  currency text check (currency in ('JPY', 'USD')),
  period_type text not null check (period_type in ('FY', 'Q')),
  period_start date not null,
  period_end date not null,
  reported_at date,
  source_id uuid references public.research_sources(id) on delete set null,
  source_report_id uuid references public.research_reports(id) on delete set null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists financial_metrics_user_instrument_idx
  on public.financial_metrics (user_id, instrument_id, metric_key);

alter table public.financial_metrics enable row level security;
create policy "users manage own financial metrics"
on public.financial_metrics for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.management_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  person_name text not null,
  role text,
  statement text not null,
  statement_date date,
  topic text not null check (
    topic in (
      'guidance', 'strategy', 'margin', 'capital_allocation', 'm_and_a', 'ai',
      'product', 'international', 'shareholder_return', 'risk', 'competition', 'other'
    )
  ),
  source_id uuid references public.research_sources(id) on delete set null,
  source_report_id uuid references public.research_reports(id) on delete set null,
  page integer,
  confidence text check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists management_statements_user_instrument_idx
  on public.management_statements (user_id, instrument_id);

alter table public.management_statements enable row level security;
create policy "users manage own management statements"
on public.management_statements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.research_opinions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  author text not null,
  organization text,
  stance text,
  summary text not null,
  rating numeric,
  target_price numeric,
  published_at date,
  source_id uuid references public.research_sources(id) on delete set null,
  source_url text,
  reliability text check (reliability in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists research_opinions_user_instrument_idx
  on public.research_opinions (user_id, instrument_id);

alter table public.research_opinions enable row level security;
create policy "users manage own research opinions"
on public.research_opinions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'earnings', 'guidance', 'm_and_a', 'buyback', 'dividend', 'capital_raise',
      'product', 'regulation', 'lawsuit', 'management_change', 'restructuring',
      'partnership', 'other'
    )
  ),
  title text not null,
  description text,
  event_date date not null,
  source_id uuid references public.research_sources(id) on delete set null,
  source_report_id uuid references public.research_reports(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists company_events_user_instrument_idx
  on public.company_events (user_id, instrument_id, event_date desc);

alter table public.company_events enable row level security;
create policy "users manage own company events"
on public.company_events for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.company_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  risk_type text not null,
  description text not null,
  severity text check (severity in ('low', 'medium', 'high')),
  likelihood text check (likelihood in ('low', 'medium', 'high')),
  source_id uuid references public.research_sources(id) on delete set null,
  detected_at date,
  created_at timestamptz not null default now()
);

create index if not exists company_risks_user_instrument_idx
  on public.company_risks (user_id, instrument_id);

alter table public.company_risks enable row level security;
create policy "users manage own company risks"
on public.company_risks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.company_catalysts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  catalyst_type text,
  description text not null,
  expected_timing text,
  impact text check (impact in ('low', 'medium', 'high')),
  source_id uuid references public.research_sources(id) on delete set null,
  source_report_id uuid references public.research_reports(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists company_catalysts_user_instrument_idx
  on public.company_catalysts (user_id, instrument_id);

alter table public.company_catalysts enable row level security;
create policy "users manage own company catalysts"
on public.company_catalysts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  model text not null,
  analysis_version text not null,
  scoring_version text not null,
  input_snapshot jsonb not null,
  evidence_hash text not null,
  quant_score numeric,
  qual_score numeric,
  medium_score numeric,
  long_score numeric,
  confidence numeric,
  result_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists analysis_runs_instrument_created_idx
  on public.analysis_runs (instrument_id, created_at desc);

alter table public.analysis_runs enable row level security;
create policy "users manage own analysis runs"
on public.analysis_runs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verify SQL by reading it against every existing table's naming/constraint style once more**

Check: every `references public.instruments(id)` and `references auth.users(id)` matches spelling used in `0001_init.sql`/`0005_simulation.sql`. Check every `check (... in (...))` list has no trailing comma (Postgres allows it but existing migrations don't use one — stay consistent). Check every RLS policy name is unique across the whole migration history (grep the other five migration files for the exact policy string, none should collide since these are all new table names).

- [ ] **Step 3: Tell the user this migration needs manual application**

This migration is **not applied automatically**. After this task is committed, apply it via Supabase Dashboard → SQL Editor → paste `supabase/migrations/0007_evidence_schema.sql` → Run, on the project referenced by `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`. Do this on a non-production project first if one exists; there is none in this repo today, so apply directly but know Tasks 2–4 do not require the migration to be applied yet (they only add TypeScript types and pure validation code, no live queries).

- [ ] **Step 4: Commit**

```bash
cd C:\Users\takas\dev\stockscope
git add supabase/migrations/0007_evidence_schema.sql
git commit -m "feat: add evidence DB schema for investment intelligence import"
```

---

### Task 2: Extend generated `Database` type

**Files:**
- Modify: `src/types/supabase.ts:307-311` (insert nine new table blocks before the closing `};` of `Tables`, replacing the current `};\n    Views: Record<string, never>;`)

**Interfaces:**
- Consumes: table/column names from Task 1's SQL verbatim.
- Produces: `Database["public"]["Tables"]["research_sources" | "research_reports" | "financial_metrics" | "management_statements" | "research_opinions" | "company_events" | "company_risks" | "company_catalysts" | "analysis_runs"]` — consumed by every future Supabase query in later phases (`createClient<Database>()` return type).

- [ ] **Step 1: Insert the nine table type blocks**

Replace the file's closing section (currently `src/types/supabase.ts:306-311`, the `manual_fund_prices` block's closing `};` through `}`) with:

```ts
      manual_fund_prices: {
        Row: {
          instrument_id: string;
          price_date: string;
          unit_price: number;
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["manual_fund_prices"]["Row"]> &
          Pick<Database["public"]["Tables"]["manual_fund_prices"]["Row"], "instrument_id" | "price_date" | "unit_price">;
        Update: Partial<Database["public"]["Tables"]["manual_fund_prices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "manual_fund_prices_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      research_sources: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          source_type:
            | "chatgpt"
            | "claude"
            | "gemini"
            | "perplexity"
            | "official_ir"
            | "edinet"
            | "sec"
            | "analyst"
            | "investor"
            | "news"
            | "manual"
            | "other";
          source_name: string;
          source_url: string | null;
          evidence_class: "fact" | "opinion" | "ai_interpretation";
          reliability: "low" | "medium" | "high" | null;
          researched_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["research_sources"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["research_sources"]["Row"],
            "user_id" | "instrument_id" | "source_type" | "source_name"
          >;
        Update: Partial<Database["public"]["Tables"]["research_sources"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "research_sources_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      research_reports: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          source_id: string | null;
          import_mode: "paste_text" | "json" | "manual_form";
          research_date: string | null;
          original_query: string | null;
          research_model: string | null;
          raw_content: string;
          structured_json: Record<string, unknown> | null;
          summary: string | null;
          user_notes: string | null;
          imported_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["research_reports"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["research_reports"]["Row"],
            "user_id" | "instrument_id" | "import_mode" | "raw_content"
          >;
        Update: Partial<Database["public"]["Tables"]["research_reports"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "research_reports_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_reports_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_metrics: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          metric_key: string;
          value: number;
          unit: string | null;
          currency: "JPY" | "USD" | null;
          period_type: "FY" | "Q";
          period_start: string;
          period_end: string;
          reported_at: string | null;
          source_id: string | null;
          source_report_id: string | null;
          is_manual: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["financial_metrics"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["financial_metrics"]["Row"],
            "user_id" | "instrument_id" | "metric_key" | "value" | "period_type" | "period_start" | "period_end"
          >;
        Update: Partial<Database["public"]["Tables"]["financial_metrics"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "financial_metrics_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_metrics_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_metrics_source_report_id_fkey";
            columns: ["source_report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      management_statements: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          person_name: string;
          role: string | null;
          statement: string;
          statement_date: string | null;
          topic:
            | "guidance"
            | "strategy"
            | "margin"
            | "capital_allocation"
            | "m_and_a"
            | "ai"
            | "product"
            | "international"
            | "shareholder_return"
            | "risk"
            | "competition"
            | "other";
          source_id: string | null;
          source_report_id: string | null;
          page: number | null;
          confidence: "low" | "medium" | "high" | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["management_statements"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["management_statements"]["Row"],
            "user_id" | "instrument_id" | "person_name" | "statement" | "topic"
          >;
        Update: Partial<Database["public"]["Tables"]["management_statements"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "management_statements_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "management_statements_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "management_statements_source_report_id_fkey";
            columns: ["source_report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      research_opinions: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          author: string;
          organization: string | null;
          stance: string | null;
          summary: string;
          rating: number | null;
          target_price: number | null;
          published_at: string | null;
          source_id: string | null;
          source_url: string | null;
          reliability: "low" | "medium" | "high" | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["research_opinions"]["Row"]> &
          Pick<Database["public"]["Tables"]["research_opinions"]["Row"], "user_id" | "instrument_id" | "author" | "summary">;
        Update: Partial<Database["public"]["Tables"]["research_opinions"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "research_opinions_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_opinions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      company_events: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          event_type:
            | "earnings"
            | "guidance"
            | "m_and_a"
            | "buyback"
            | "dividend"
            | "capital_raise"
            | "product"
            | "regulation"
            | "lawsuit"
            | "management_change"
            | "restructuring"
            | "partnership"
            | "other";
          title: string;
          description: string | null;
          event_date: string;
          source_id: string | null;
          source_report_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_events"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["company_events"]["Row"],
            "user_id" | "instrument_id" | "event_type" | "title" | "event_date"
          >;
        Update: Partial<Database["public"]["Tables"]["company_events"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "company_events_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_events_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_events_source_report_id_fkey";
            columns: ["source_report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      company_risks: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          risk_type: string;
          description: string;
          severity: "low" | "medium" | "high" | null;
          likelihood: "low" | "medium" | "high" | null;
          source_id: string | null;
          detected_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_risks"]["Row"]> &
          Pick<Database["public"]["Tables"]["company_risks"]["Row"], "user_id" | "instrument_id" | "risk_type" | "description">;
        Update: Partial<Database["public"]["Tables"]["company_risks"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "company_risks_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_risks_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      company_catalysts: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          catalyst_type: string | null;
          description: string;
          expected_timing: string | null;
          impact: "low" | "medium" | "high" | null;
          source_id: string | null;
          source_report_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_catalysts"]["Row"]> &
          Pick<Database["public"]["Tables"]["company_catalysts"]["Row"], "user_id" | "instrument_id" | "description">;
        Update: Partial<Database["public"]["Tables"]["company_catalysts"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "company_catalysts_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_catalysts_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "research_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_catalysts_source_report_id_fkey";
            columns: ["source_report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      analysis_runs: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          model: string;
          analysis_version: string;
          scoring_version: string;
          input_snapshot: Record<string, unknown>;
          evidence_hash: string;
          quant_score: number | null;
          qual_score: number | null;
          medium_score: number | null;
          long_score: number | null;
          confidence: number | null;
          result_json: Record<string, unknown> | null;
          status: "pending" | "success" | "failed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["analysis_runs"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["analysis_runs"]["Row"],
            "user_id" | "instrument_id" | "model" | "analysis_version" | "scoring_version" | "input_snapshot" | "evidence_hash"
          >;
        Update: Partial<Database["public"]["Tables"]["analysis_runs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "analysis_runs_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd C:\Users\takas\dev\stockscope && npx tsc --noEmit`
Expected: no errors (this file has no consumers yet, so this only validates the type block itself is syntactically and structurally sound against the `Relationship` type declared at the top of the file).

- [ ] **Step 3: Commit**

```bash
git add src/types/supabase.ts
git commit -m "feat: add generated types for evidence DB tables"
```

---

### Task 3: Domain types

**Files:**
- Create: `src/types/evidence.ts`

**Interfaces:**
- Consumes: nothing (leaf file, camelCase mirror of Task 2's snake_case `Database` rows).
- Produces: `SourceType`, `EvidenceClass`, `ImportMode`, `StatementTopic`, `EventType`, `RiskLevel`, `MetricKey`, `ResearchSource`, `ResearchReport`, `FinancialMetric`, `ManagementStatement`, `ResearchOpinion`, `CompanyEvent`, `CompanyRisk`, `CompanyCatalyst`, `AnalysisRun` — consumed by Task 4 (Zod schemas mirror these shapes) and every later phase's UI/API code.

- [ ] **Step 1: Write the file**

```ts
export type SourceType =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "official_ir"
  | "edinet"
  | "sec"
  | "analyst"
  | "investor"
  | "news"
  | "manual"
  | "other";

export type EvidenceClass = "fact" | "opinion" | "ai_interpretation";
export type ImportMode = "paste_text" | "json" | "manual_form";
export type ConfidenceLevel = "low" | "medium" | "high";

export type StatementTopic =
  | "guidance"
  | "strategy"
  | "margin"
  | "capital_allocation"
  | "m_and_a"
  | "ai"
  | "product"
  | "international"
  | "shareholder_return"
  | "risk"
  | "competition"
  | "other";

export type EventType =
  | "earnings"
  | "guidance"
  | "m_and_a"
  | "buyback"
  | "dividend"
  | "capital_raise"
  | "product"
  | "regulation"
  | "lawsuit"
  | "management_change"
  | "restructuring"
  | "partnership"
  | "other";

export type PeriodType = "FY" | "Q";
export type AnalysisStatus = "pending" | "success" | "failed";

// 定量スコアリング（src/lib/scoring）が参照する既知のmetric key。
// DBのmetric_keyはtext型（自由入力を禁止し、常にこのunionでZod検証する）。
export type MetricKey =
  | "revenue"
  | "operating_income"
  | "net_income"
  | "eps"
  | "fcf"
  | "cash"
  | "debt"
  | "roe"
  | "roic"
  | "operating_margin"
  | "net_margin"
  | "per"
  | "pbr"
  | "ev_ebitda"
  | "dividend_yield"
  | "dividend_payout"
  | "current_ratio"
  | "net_debt"
  | "net_debt_ebitda"
  | "fcf_yield"
  | "fcf_margin";

export interface ResearchSource {
  id: string;
  instrumentId: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  evidenceClass: EvidenceClass;
  reliability: ConfidenceLevel | null;
  researchedAt: string | null;
  createdAt: string;
}

export interface ResearchReport {
  id: string;
  instrumentId: string;
  sourceId: string | null;
  importMode: ImportMode;
  researchDate: string | null;
  originalQuery: string | null;
  researchModel: string | null;
  rawContent: string;
  structuredJson: Record<string, unknown> | null;
  summary: string | null;
  userNotes: string | null;
  importedAt: string;
}

export interface FinancialMetric {
  id: string;
  instrumentId: string;
  metricKey: MetricKey;
  value: number;
  unit: string | null;
  currency: "JPY" | "USD" | null;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  reportedAt: string | null;
  sourceId: string | null;
  sourceReportId: string | null;
  isManual: boolean;
  createdAt: string;
}

export interface ManagementStatement {
  id: string;
  instrumentId: string;
  personName: string;
  role: string | null;
  statement: string;
  statementDate: string | null;
  topic: StatementTopic;
  sourceId: string | null;
  sourceReportId: string | null;
  page: number | null;
  confidence: ConfidenceLevel | null;
  createdAt: string;
}

export interface ResearchOpinion {
  id: string;
  instrumentId: string;
  author: string;
  organization: string | null;
  stance: string | null;
  summary: string;
  rating: number | null;
  targetPrice: number | null;
  publishedAt: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  reliability: ConfidenceLevel | null;
  createdAt: string;
}

export interface CompanyEvent {
  id: string;
  instrumentId: string;
  eventType: EventType;
  title: string;
  description: string | null;
  eventDate: string;
  sourceId: string | null;
  sourceReportId: string | null;
  createdAt: string;
}

export interface CompanyRisk {
  id: string;
  instrumentId: string;
  riskType: string;
  description: string;
  severity: ConfidenceLevel | null;
  likelihood: ConfidenceLevel | null;
  sourceId: string | null;
  detectedAt: string | null;
  createdAt: string;
}

export interface CompanyCatalyst {
  id: string;
  instrumentId: string;
  catalystType: string | null;
  description: string;
  expectedTiming: string | null;
  impact: ConfidenceLevel | null;
  sourceId: string | null;
  sourceReportId: string | null;
  createdAt: string;
}

export interface AnalysisRun {
  id: string;
  instrumentId: string;
  model: string;
  analysisVersion: string;
  scoringVersion: string;
  inputSnapshot: Record<string, unknown>;
  evidenceHash: string;
  quantScore: number | null;
  qualScore: number | null;
  mediumScore: number | null;
  longScore: number | null;
  confidence: number | null;
  resultJson: Record<string, unknown> | null;
  status: AnalysisStatus;
  createdAt: string;
}
```

- [ ] **Step 2: Type-check**

Run: `cd C:\Users\takas\dev\stockscope && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/evidence.ts
git commit -m "feat: add domain types for evidence entities"
```

---

### Task 4: Zod schemas for structured research import

**Files:**
- Create: `src/lib/evidence/schemas.ts`
- Test: `tests/unit/evidence-schemas.test.ts`

**Interfaces:**
- Consumes: `MetricKey`, `SourceType`, `StatementTopic`, `EventType`, `ConfidenceLevel` from `src/types/evidence.ts` (Task 3).
- Produces: `SourceSchema`, `FinancialMetricInputSchema`, `ManagementStatementInputSchema`, `RiskInputSchema`, `CatalystInputSchema`, `ExternalOpinionInputSchema`, `EventInputSchema`, `ResearchImportSchema` (the top-level schema for the standardized external-AI JSON, matching your spec item 13), and inferred types `ResearchImportInput` — consumed by the Phase P2 `/api/research/import` route (not built in this phase) and by `docs/research/stockscope_ai_research_prompt.md` as the schema external AI tools must produce.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { ResearchImportSchema } from "@/lib/evidence/schemas";

describe("ResearchImportSchema", () => {
  it("accepts a minimal valid research import", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [{ sourceType: "chatgpt", sourceName: "ChatGPT Deep Research" }],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "Sony's semiconductor and entertainment segments show accelerating margin expansion.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated research import with nested evidence", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [
        { sourceType: "official_ir", sourceName: "FY2026 Q2 Earnings Presentation", sourceUrl: "https://example.com/ir" },
      ],
      financials: [
        {
          metricKey: "operating_margin",
          value: 12.4,
          unit: "percent",
          periodType: "Q",
          periodStart: "2026-04-01",
          periodEnd: "2026-06-30",
        },
      ],
      managementStatements: [
        {
          personName: "Kenichiro Yoshida",
          role: "CEO",
          statement: "We expect the semiconductor segment to sustain double-digit margin growth.",
          topic: "guidance",
        },
      ],
      catalysts: [{ description: "New image sensor product launch expected Q3", impact: "high" }],
      risks: [{ riskType: "fx", description: "Yen appreciation could compress overseas segment margins", severity: "medium" }],
      investorOpinions: [{ author: "Jane Analyst", summary: "Overweight rating on margin trajectory", rating: 4 }],
      events: [{ eventType: "earnings", title: "Q2 FY2026 results announced", eventDate: "2026-08-05" }],
      summary: "Comprehensive research on Sony Group covering financials, guidance, and competitive risk.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing company ticker with a field-specific error path", () => {
    const result = ResearchImportSchema.safeParse({
      company: { name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["company", "ticker"]);
    }
  });

  it("rejects an invalid financial metric period range (end before start)", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [
        {
          metricKey: "revenue",
          value: 1000,
          periodType: "FY",
          periodStart: "2026-04-01",
          periodEnd: "2025-04-01",
        },
      ],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "financials.0.periodEnd")).toBe(true);
    }
  });

  it("rejects an unknown metricKey not in the MetricKey union", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [
        { metricKey: "made_up_metric", value: 1, periodType: "FY", periodStart: "2026-04-01", periodEnd: "2027-03-31" },
      ],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a research import with no summary", () => {
    const result = ResearchImportSchema.safeParse({
      company: { ticker: "6758", name: "Sony Group", exchange: "TSE" },
      researchDate: "2026-08-20",
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\takas\dev\stockscope && npx vitest run tests/unit/evidence-schemas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/evidence/schemas'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
import { z } from "zod";
import type { EventType, MetricKey, SourceType, StatementTopic } from "@/types/evidence";

const sourceTypeValues: [SourceType, ...SourceType[]] = [
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
];

const metricKeyValues: [MetricKey, ...MetricKey[]] = [
  "revenue",
  "operating_income",
  "net_income",
  "eps",
  "fcf",
  "cash",
  "debt",
  "roe",
  "roic",
  "operating_margin",
  "net_margin",
  "per",
  "pbr",
  "ev_ebitda",
  "dividend_yield",
  "dividend_payout",
  "current_ratio",
  "net_debt",
  "net_debt_ebitda",
  "fcf_yield",
  "fcf_margin",
];

const statementTopicValues: [StatementTopic, ...StatementTopic[]] = [
  "guidance",
  "strategy",
  "margin",
  "capital_allocation",
  "m_and_a",
  "ai",
  "product",
  "international",
  "shareholder_return",
  "risk",
  "competition",
  "other",
];

const eventTypeValues: [EventType, ...EventType[]] = [
  "earnings",
  "guidance",
  "m_and_a",
  "buyback",
  "dividend",
  "capital_raise",
  "product",
  "regulation",
  "lawsuit",
  "management_change",
  "restructuring",
  "partnership",
  "other",
];

const confidenceLevelSchema = z.enum(["low", "medium", "high"]);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const SourceSchema = z.object({
  sourceType: z.enum(sourceTypeValues),
  sourceName: z.string().trim().min(1, "sourceName is required"),
  sourceUrl: z.string().url().optional(),
  reliability: confidenceLevelSchema.optional(),
});
export type SourceInput = z.infer<typeof SourceSchema>;

export const FinancialMetricInputSchema = z
  .object({
    metricKey: z.enum(metricKeyValues),
    value: z.number(),
    unit: z.string().optional(),
    currency: z.enum(["JPY", "USD"]).optional(),
    periodType: z.enum(["FY", "Q"]),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    reportedAt: isoDateSchema.optional(),
  })
  .refine((metric) => metric.periodEnd >= metric.periodStart, {
    message: "periodEnd must not be before periodStart",
    path: ["periodEnd"],
  });
export type FinancialMetricInput = z.infer<typeof FinancialMetricInputSchema>;

export const ManagementStatementInputSchema = z.object({
  personName: z.string().trim().min(1, "personName is required"),
  role: z.string().optional(),
  statement: z.string().trim().min(1, "statement is required"),
  statementDate: isoDateSchema.optional(),
  topic: z.enum(statementTopicValues),
  page: z.number().int().positive().optional(),
  confidence: confidenceLevelSchema.optional(),
});
export type ManagementStatementInput = z.infer<typeof ManagementStatementInputSchema>;

export const CatalystInputSchema = z.object({
  catalystType: z.string().optional(),
  description: z.string().trim().min(1, "description is required"),
  expectedTiming: z.string().optional(),
  impact: confidenceLevelSchema.optional(),
});
export type CatalystInput = z.infer<typeof CatalystInputSchema>;

export const RiskInputSchema = z.object({
  riskType: z.string().trim().min(1, "riskType is required"),
  description: z.string().trim().min(1, "description is required"),
  severity: confidenceLevelSchema.optional(),
  likelihood: confidenceLevelSchema.optional(),
  detectedAt: isoDateSchema.optional(),
});
export type RiskInput = z.infer<typeof RiskInputSchema>;

export const ExternalOpinionInputSchema = z.object({
  author: z.string().trim().min(1, "author is required"),
  organization: z.string().optional(),
  stance: z.string().optional(),
  summary: z.string().trim().min(1, "summary is required"),
  rating: z.number().optional(),
  targetPrice: z.number().positive().optional(),
  publishedAt: isoDateSchema.optional(),
  sourceUrl: z.string().url().optional(),
});
export type ExternalOpinionInput = z.infer<typeof ExternalOpinionInputSchema>;

export const EventInputSchema = z.object({
  eventType: z.enum(eventTypeValues),
  title: z.string().trim().min(1, "title is required"),
  description: z.string().optional(),
  eventDate: isoDateSchema,
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const ResearchImportSchema = z.object({
  company: z.object({
    ticker: z.string().trim().min(1, "company.ticker is required"),
    name: z.string().trim().min(1, "company.name is required"),
    exchange: z.string().trim().min(1, "company.exchange is required"),
  }),
  researchDate: isoDateSchema,
  sources: z.array(SourceSchema),
  financials: z.array(FinancialMetricInputSchema),
  valuation: z.record(z.string(), z.unknown()).optional(),
  managementStatements: z.array(ManagementStatementInputSchema),
  catalysts: z.array(CatalystInputSchema),
  risks: z.array(RiskInputSchema),
  investorOpinions: z.array(ExternalOpinionInputSchema),
  events: z.array(EventInputSchema),
  summary: z.string().trim().min(1, "summary is required"),
});
export type ResearchImportInput = z.infer<typeof ResearchImportSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\takas\dev\stockscope && npx vitest run tests/unit/evidence-schemas.test.ts`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Type-check the whole project**

Run: `cd C:\Users\takas\dev\stockscope && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidence/schemas.ts tests/unit/evidence-schemas.test.ts
git commit -m "feat: add Zod schemas for standardized research import JSON"
```

---

## Definition of Done for Phase P1

- [ ] `supabase/migrations/0007_evidence_schema.sql` exists and is committed (application to the live project is a manual step for the user, tracked separately — not part of "done" for this coding phase).
- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` passes with zero failures (all existing tests plus the new `evidence-schemas.test.ts`).
- [ ] No existing file outside `src/types/supabase.ts` (extended, not rewritten) was modified.
- [ ] Nothing in this phase touches `stocks/[symbol]/page.tsx`, any existing API route, or any existing component — verified by `git diff --stat` showing only the 4 new/modified files across the 4 tasks.

## What's Deliberately Not in This Phase

No API routes, no UI, no Evidence Builder, no scoring, no Cloudflare AI — those are Phases P2–P7 of the roadmap already shared with you, each to get its own plan via this same skill once P1 is reviewed and (for the migration) manually applied.
