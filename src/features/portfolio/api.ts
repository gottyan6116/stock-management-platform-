import type { PositionApiItem } from "@/features/portfolio/types";

export const POSITIONS_KEY = ["positions"] as const;

export async function fetchPositions(): Promise<PositionApiItem[]> {
  const res = await fetch("/api/positions");
  if (!res.ok) throw new Error(`positions request failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}
