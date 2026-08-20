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
