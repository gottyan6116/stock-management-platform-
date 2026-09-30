import { useQuery } from "@tanstack/react-query";

export interface PurchaseItem {
  id: string;
  instrumentId: string;
  name: string;
  nisaType: "tsumitate" | "growth" | null;
  side: "buy" | "sell";
  tradedOn: string;
  quantity: number | null;
  amountJpy: number;
}

export const purchasesKey = (year: number) => ["purchases", year] as const;

export async function fetchPurchases(year: number): Promise<PurchaseItem[]> {
  const res = await fetch(`/api/purchases?year=${year}`);
  if (!res.ok) throw new Error(`purchases request failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export function usePurchases(year: number) {
  return useQuery({ queryKey: purchasesKey(year), queryFn: () => fetchPurchases(year) });
}
