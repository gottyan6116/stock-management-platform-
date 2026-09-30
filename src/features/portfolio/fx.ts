import { useQuery } from "@tanstack/react-query";
import type { FxRate } from "@/lib/portfolio/valuation";

export const FX_KEY = ["fx-usdjpy"] as const;

export async function fetchUsdJpy(): Promise<FxRate | null> {
  const res = await fetch("/api/fx/usdjpy");
  if (!res.ok) throw new Error(`fx request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

/** null = レートを取得できなかった（USD分は換算せず注記する）。 */
export function useUsdJpy() {
  return useQuery({ queryKey: FX_KEY, queryFn: fetchUsdJpy, staleTime: 5 * 60_000 });
}
