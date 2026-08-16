import { afterEach, describe, expect, it } from "vitest";
import { isSampleResearchEnabled } from "@/config/research";
import {
  SAMPLE_OUTLOOKS,
  calculateEvidenceCompleteness,
  getResearchOutlook,
  summarizePortfolioSampleOutlook,
} from "@/features/research/sample-outlooks";

describe("sample research outlook", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH;
  });

  it("always identifies sample data", () => {
    expect(getResearchOutlook("7203.T")).toMatchObject({
      dataKind: "sample",
      sampleLabel: "サンプル",
      source: "表示確認用の固定サンプル",
      modelVersion: "sample-v1",
      updatedAt: "2026-08-16T00:00:00.000Z",
      horizonScores: {
        "1y": {
          benchmarkOutperformanceProbability: 54,
          expectedReturnRange: { minPercent: -12, maxPercent: 18 },
        },
      },
    });
    expect(Object.values(SAMPLE_OUTLOOKS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataKind: "sample", sampleLabel: "サンプル" }),
      ])
    );
  });

  it("calculates completeness from current evidence categories", () => {
    expect(
      calculateEvidenceCompleteness([
        { category: "prices", status: "current" },
        { category: "financials", status: "current" },
        { category: "competitors", status: "missing" },
      ])
    ).toBe(67);
    expect(calculateEvidenceCompleteness([])).toBe(0);
  });

  it("enables sample research only for the exact public flag value", () => {
    expect(isSampleResearchEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH = "TRUE";
    expect(isSampleResearchEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH = "true";
    expect(isSampleResearchEnabled()).toBe(true);
  });

  it("returns neutral, non-company-specific sample data for unknown symbols", () => {
    const outlook = getResearchOutlook("unknown");

    expect(outlook).toMatchObject({
      symbol: "UNKNOWN",
      dataKind: "sample",
      sampleLabel: "サンプル",
      positiveFactors: [],
      cautionFactors: [],
      horizonScores: {
        "1y": {
          positiveProbability: 50,
          benchmarkOutperformanceProbability: 50,
          expectedReturnRange: null,
          action: "watch",
        },
        "3y": {
          positiveProbability: 50,
          benchmarkOutperformanceProbability: 50,
          expectedReturnRange: null,
          action: "watch",
        },
      },
      source: "表示確認用の固定サンプル",
      modelVersion: "sample-v1",
      updatedAt: null,
    });
    expect(outlook.unknowns.length).toBeGreaterThan(0);
  });

  it("summarizes a horizon by equal-weighting holdings without mixing currency values", () => {
    const summary = summarizePortfolioSampleOutlook(
      [getResearchOutlook("7203.T"), getResearchOutlook("UNKNOWN")],
      "1y"
    );

    expect(summary).toEqual({
      positiveProbability: 54,
      downsideRisk: "medium",
      holdingCount: 2,
      method: "equal-weighted-holdings",
    });
  });
});
