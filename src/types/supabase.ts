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
          instrument_type: "stock" | "etf" | "index";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
