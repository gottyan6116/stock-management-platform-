/**
 * 銘柄詳細のタブは、データが存在するものだけ表示する（Phase 1）。
 * 「概要」と、資料を取り込む入口である「リサーチ」は常に表示する。
 */
export type DetailTabId = "overview" | "outlook" | "financials" | "statements" | "evidence" | "research" | "ai-analysis";

export interface DetailTabAvailability {
  hasSampleOutlook: boolean;
  financialMetricCount: number;
  managementStatementCount: number;
  companyEventCount: number;
  researchReportCount: number;
  hasAnalysisRun: boolean;
}

export function getVisibleDetailTabIds(a: DetailTabAvailability): DetailTabId[] {
  const ids: DetailTabId[] = ["overview"];
  if (a.hasSampleOutlook) ids.push("outlook");
  if (a.financialMetricCount > 0) ids.push("financials");
  if (a.managementStatementCount + a.companyEventCount > 0) ids.push("statements");
  if (a.hasSampleOutlook) ids.push("evidence");
  ids.push("research");
  // 分析の材料（資料か財務指標）が無ければ実行しても「データ不足」になるだけなので出さない。
  if (a.hasAnalysisRun || a.researchReportCount > 0 || a.financialMetricCount > 0) ids.push("ai-analysis");
  return ids;
}
