// supabase/migrations/0001_init.sql に対応する手書きの型定義。
// Phase 2時点ではSupabaseプロジェクト未作成のため `supabase gen types` が使えず、
// プロジェクト作成後は `supabase gen types typescript` の出力に置き換える想定。
//
// postgrest-jsのGenericTable/GenericSchema制約を満たすため、Relationships（外部キー）と
// スキーマ直下のViews/Functionsを明示している。省略するとjoin select等の型解決がneverになる。

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      instruments: {
        Row: {
          id: string;
          provider: string;
          provider_symbol: string;
          display_symbol: string;
          name: string;
          exchange: string | null;
          market: "JP" | "US";
          currency: "JPY" | "USD";
          instrument_type: "stock" | "etf" | "index" | "fund";
          sector: string | null;
          industry: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["instruments"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["instruments"]["Row"],
            "provider_symbol" | "display_symbol" | "name" | "market" | "currency" | "instrument_type"
          >;
        Update: Partial<Database["public"]["Tables"]["instruments"]["Row"]>;
        Relationships: Relationship[];
      };
      positions: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          quantity: number;
          avg_cost: number | null;
          nisa_type: "tsumitate" | "growth" | null;
          is_manual: boolean;
          manual_unit_price: number | null;
          manual_price_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          instrument_id: string;
          quantity: number;
          avg_cost?: number | null;
          nisa_type?: "tsumitate" | "growth" | null;
          is_manual?: boolean;
          manual_unit_price?: number | null;
          manual_price_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["positions"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "positions_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          instrument_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["favorites"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "favorites_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_prices: {
        Row: {
          instrument_id: string;
          trading_date: string;
          open: number | null;
          high: number | null;
          low: number | null;
          close: number | null;
          adjusted_close: number | null;
          volume: number | null;
          source: string;
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_prices"]["Row"]> &
          Pick<Database["public"]["Tables"]["daily_prices"]["Row"], "instrument_id" | "trading_date">;
        Update: Partial<Database["public"]["Tables"]["daily_prices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "daily_prices_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_snapshots: {
        Row: {
          instrument_id: string;
          price_date: string | null;
          fetched_at: string;
          close: number | null;
          previous_close: number | null;
          change: number | null;
          change_percent: number | null;
          dividend_yield: number | null;
          market_cap: number | null;
          trailing_pe: number | null;
          forward_pe: number | null;
          raw_currency: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["quote_snapshots"]["Row"]> &
          Pick<Database["public"]["Tables"]["quote_snapshots"]["Row"], "instrument_id">;
        Update: Partial<Database["public"]["Tables"]["quote_snapshots"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "quote_snapshots_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: true;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rates: {
        Row: {
          pair: string;
          rate_date: string;
          close: number;
          fetched_at: string;
        };
        Insert: Database["public"]["Tables"]["fx_rates"]["Row"];
        Update: Partial<Database["public"]["Tables"]["fx_rates"]["Row"]>;
        Relationships: Relationship[];
      };
      sync_runs: {
        Row: {
          id: string;
          trigger_type: "cron" | "manual" | "initial_backfill";
          status: "running" | "success" | "partial_success" | "failed";
          started_at: string;
          finished_at: string | null;
          requested_count: number;
          success_count: number;
          failure_count: number;
          error_summary: unknown | null;
        };
        Insert: Partial<Database["public"]["Tables"]["sync_runs"]["Row"]> &
          Pick<Database["public"]["Tables"]["sync_runs"]["Row"], "trigger_type" | "status">;
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Row"]>;
        Relationships: Relationship[];
      };
      sync_items: {
        Row: {
          id: string;
          sync_run_id: string;
          instrument_id: string | null;
          status: "success" | "failed" | "skipped";
          message: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["sync_items"]["Row"]> &
          Pick<Database["public"]["Tables"]["sync_items"]["Row"], "sync_run_id" | "status">;
        Update: Partial<Database["public"]["Tables"]["sync_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "sync_items_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_items_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_accounts: {
        Row: {
          user_id: string;
          cash_balance_jpy: number;
          cash_balance_usd: number;
          initial_balance_jpy: number;
          initial_balance_usd: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["simulation_accounts"]["Row"]> &
          Pick<Database["public"]["Tables"]["simulation_accounts"]["Row"], "user_id">;
        Update: Partial<Database["public"]["Tables"]["simulation_accounts"]["Row"]>;
        Relationships: Relationship[];
      };
      simulation_holdings: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          quantity: number;
          avg_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["simulation_holdings"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["simulation_holdings"]["Row"],
            "user_id" | "instrument_id" | "quantity" | "avg_cost"
          >;
        Update: Partial<Database["public"]["Tables"]["simulation_holdings"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "simulation_holdings_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_trades: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          side: "buy" | "sell";
          quantity: number;
          price: number;
          currency: "JPY" | "USD";
          realized_pnl: number | null;
          executed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["simulation_trades"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["simulation_trades"]["Row"],
            "user_id" | "instrument_id" | "side" | "quantity" | "price" | "currency"
          >;
        Update: Partial<Database["public"]["Tables"]["simulation_trades"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "simulation_trades_instrument_id_fkey";
            columns: ["instrument_id"];
            isOneToOne: false;
            referencedRelation: "instruments";
            referencedColumns: ["id"];
          },
        ];
      };
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
