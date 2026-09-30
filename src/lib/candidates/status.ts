export const CANDIDATE_STATUSES = ["unevaluated", "considering", "purchased", "passed"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  unevaluated: "未評価",
  considering: "検討中",
  purchased: "購入済",
  passed: "見送り",
};

export function isCandidateStatus(value: unknown): value is CandidateStatus {
  return typeof value === "string" && (CANDIDATE_STATUSES as readonly string[]).includes(value);
}
