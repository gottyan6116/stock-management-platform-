import { useQuery } from "@tanstack/react-query";
import type { ScenarioResult } from "@/lib/candidates/expected-return";
import type { Horizon, OutcomeStatus, WinRate } from "@/lib/candidates/outcome";
import type { ScenarioInputs } from "@/lib/candidates/scenarios";
import type { CandidateStatus } from "@/lib/candidates/status";

export interface CandidateItem {
  instrumentId: string;
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  market: "JP" | "US";
  currency: "JPY" | "USD";
  status: CandidateStatus;
  addedAt: string;
}

export interface DecisionSheetData {
  instrument: { id: string; name: string; displaySymbol: string };
  market: {
    price: number | null;
    priceDate: string | null;
    currency: "JPY" | "USD";
    dividendYieldPct: number | null;
    currentPer: number | null;
  };
  sheet: { thesisWhy: string; thesisWrong: string; scenarios: ScenarioInputs };
  hurdlePct: number | null;
  benchmark: { instrumentId: string; name: string; nav: number | null; navDate: string | null } | null;
}

export interface DecisionView {
  id: string;
  instrumentId: string;
  name: string;
  displaySymbol: string;
  decision: "buy" | "pass";
  decidedOn: string;
  price: number;
  currency: "JPY" | "USD";
  hurdlePct: number | null;
  thesisWhy: string;
  thesisWrong: string;
  baseAnnualPct: number | null;
  outcomes: Record<Horizon, OutcomeStatus>;
}

export interface DecisionsData {
  decisions: DecisionView[];
  winRates: Record<Horizon, WinRate>;
  benchmarkConfigured: boolean;
}

export interface SettingsData {
  benchmarkExpectedReturn: number | null;
  benchmarkInstrumentId: string | null;
  fundChoices: { id: string; name: string }[];
}

export type { ScenarioResult };

export const CANDIDATES_KEY = ["candidates"] as const;
export const DECISIONS_KEY = ["decisions"] as const;
export const SETTINGS_KEY = ["settings"] as const;
export const sheetKey = (instrumentId: string) => ["decision-sheet", instrumentId] as const;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()).data as T;
}

/** 書き込み系。失敗時はAPIの日本語メッセージをそのまま投げる。 */
export async function sendJson(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "保存に失敗しました。時間をおいて再度お試しください。");
  }
}

export const useCandidates = () =>
  useQuery({ queryKey: CANDIDATES_KEY, queryFn: () => getJson<CandidateItem[]>("/api/candidates") });

export const useDecisionSheet = (instrumentId: string) =>
  useQuery({
    queryKey: sheetKey(instrumentId),
    queryFn: () => getJson<DecisionSheetData>(`/api/decision-sheets/${encodeURIComponent(instrumentId)}`),
  });

export const useDecisions = () =>
  useQuery({ queryKey: DECISIONS_KEY, queryFn: () => getJson<DecisionsData>("/api/decisions"), staleTime: 5 * 60_000 });

export const useSettings = () => useQuery({ queryKey: SETTINGS_KEY, queryFn: () => getJson<SettingsData>("/api/settings") });
