import type { FreshnessInfo, FreshnessStatus } from "@/types/domain";

const STALE_THRESHOLD_HOURS = 24;

export function computeFreshnessStatus(params: {
  priceDate: string | null;
  fetchedAt: string | null;
  syncFailed?: boolean;
  now?: Date;
}): FreshnessStatus {
  const { priceDate, fetchedAt, syncFailed = false, now = new Date() } = params;

  if (syncFailed) return "failed";
  if (!priceDate || !fetchedAt) return "unknown";

  const fetchedAtDate = new Date(fetchedAt);
  const ageHours = (now.getTime() - fetchedAtDate.getTime()) / (60 * 60 * 1000);
  if (ageHours > STALE_THRESHOLD_HOURS) return "stale";

  return "ok";
}

export function toFreshnessInfo(params: {
  priceDate: string | null;
  fetchedAt: string | null;
  syncFailed?: boolean;
  now?: Date;
}): FreshnessInfo {
  return {
    status: computeFreshnessStatus(params),
    priceDate: params.priceDate,
    fetchedAt: params.fetchedAt,
  };
}
