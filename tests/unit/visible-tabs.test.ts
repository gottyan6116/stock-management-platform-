import { describe, expect, it } from "vitest";
import { getVisibleDetailTabIds, type DetailTabAvailability } from "@/features/research/visible-tabs";

const empty: DetailTabAvailability = {
  hasSampleOutlook: false,
  financialMetricCount: 0,
  managementStatementCount: 0,
  companyEventCount: 0,
  researchReportCount: 0,
  hasAnalysisRun: false,
};

describe("getVisibleDetailTabIds", () => {
  it("shows only overview and research (the data-entry hub) when nothing is registered", () => {
    expect(getVisibleDetailTabIds(empty)).toEqual(["overview", "research"]);
  });

  it("adds a tab only when its data exists", () => {
    expect(getVisibleDetailTabIds({ ...empty, financialMetricCount: 3 })).toEqual([
      "overview",
      "financials",
      "research",
      "ai-analysis",
    ]);
    expect(getVisibleDetailTabIds({ ...empty, companyEventCount: 1 })).toEqual(["overview", "statements", "research"]);
    expect(getVisibleDetailTabIds({ ...empty, managementStatementCount: 2 })).toEqual([
      "overview",
      "statements",
      "research",
    ]);
  });

  it("offers AI analysis once there is material to analyze or a previous run", () => {
    expect(getVisibleDetailTabIds({ ...empty, researchReportCount: 1 })).toContain("ai-analysis");
    expect(getVisibleDetailTabIds({ ...empty, hasAnalysisRun: true })).toContain("ai-analysis");
    expect(getVisibleDetailTabIds(empty)).not.toContain("ai-analysis");
  });

  it("shows the sample outlook and evidence tabs only when sample data is enabled", () => {
    expect(getVisibleDetailTabIds({ ...empty, hasSampleOutlook: true })).toEqual([
      "overview",
      "outlook",
      "evidence",
      "research",
    ]);
  });
});
