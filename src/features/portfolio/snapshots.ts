import { useQuery } from "@tanstack/react-query";

export interface SnapshotPoint {
  date: string;
  totalValueJpy: number;
  totalCostJpy: number | null;
  /** 実測ではなく推計で埋めた日。グラフでは破線にする。 */
  isEstimated: boolean;
}

export const SNAPSHOTS_KEY = ["portfolio-snapshots"] as const;

export async function fetchSnapshots(): Promise<SnapshotPoint[]> {
  const res = await fetch("/api/snapshots?days=365");
  if (!res.ok) throw new Error(`snapshots request failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

/** 今日の分を記録する。金額はサーバーが計算する。 */
export async function recordTodaySnapshot(): Promise<void> {
  const res = await fetch("/api/snapshots", { method: "POST" });
  if (!res.ok) throw new Error(`snapshot record failed: ${res.status}`);
}

export function useSnapshots() {
  return useQuery({ queryKey: SNAPSHOTS_KEY, queryFn: fetchSnapshots, staleTime: 5 * 60_000 });
}
