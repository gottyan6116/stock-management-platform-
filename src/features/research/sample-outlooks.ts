import type {
  HorizonScore,
  OutlookHorizon,
  ResearchEvidence,
  ResearchOutlook,
} from "@/features/research/types";

const SAMPLE_LABEL = "サンプル";
const SAMPLE_SOURCE = "表示確認用の固定サンプル";
const SAMPLE_MODEL_VERSION = "sample-v1";
const SAMPLE_UPDATED_AT = "2026-08-16T00:00:00.000Z";

const neutralHorizonScores: Record<OutlookHorizon, HorizonScore> = {
  "1y": {
    horizon: "1y",
    positiveProbability: 50,
    benchmarkOutperformanceProbability: 50,
    expectedReturnRange: null,
    downsideRisk: "medium",
    evidenceStrength: 0,
    action: "watch",
  },
  "3y": {
    horizon: "3y",
    positiveProbability: 50,
    benchmarkOutperformanceProbability: 50,
    expectedReturnRange: null,
    downsideRisk: "medium",
    evidenceStrength: 0,
    action: "watch",
  },
};

const sampleEvidence: readonly ResearchEvidence[] = [
  { category: "prices", status: "current", detail: "表示確認用のサンプル" },
  { category: "financials", status: "current", detail: "表示確認用のサンプル" },
  { category: "competitors", status: "missing" },
  { category: "orderBook", status: "missing" },
  { category: "statements", status: "missing" },
  { category: "events", status: "missing" },
];

export const SAMPLE_OUTLOOKS: Readonly<Record<string, ResearchOutlook>> = {
  "7203.T": {
    symbol: "7203.T",
    dataKind: "sample",
    sampleLabel: SAMPLE_LABEL,
    source: SAMPLE_SOURCE,
    modelVersion: SAMPLE_MODEL_VERSION,
    updatedAt: SAMPLE_UPDATED_AT,
    positiveFactors: ["長期見通しの表示例です。実データに基づく評価ではありません。"],
    cautionFactors: ["サンプル値のため、投資判断には利用できません。"],
    unknowns: ["銘柄固有の財務・競合・開示情報は未確認です。"],
    horizonScores: {
      "1y": {
        horizon: "1y",
        positiveProbability: 58,
        benchmarkOutperformanceProbability: 54,
        expectedReturnRange: { minPercent: -12, maxPercent: 18 },
        downsideRisk: "medium",
        evidenceStrength: 33,
        action: "watch",
      },
      "3y": {
        horizon: "3y",
        positiveProbability: 62,
        benchmarkOutperformanceProbability: 57,
        expectedReturnRange: { minPercent: -8, maxPercent: 32 },
        downsideRisk: "medium",
        evidenceStrength: 33,
        action: "hold",
      },
    },
    evidence: sampleEvidence,
  },
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function createNeutralSampleOutlook(symbol: string): ResearchOutlook {
  return {
    symbol,
    dataKind: "sample",
    sampleLabel: SAMPLE_LABEL,
    source: SAMPLE_SOURCE,
    modelVersion: SAMPLE_MODEL_VERSION,
    updatedAt: null,
    positiveFactors: [],
    cautionFactors: [],
    unknowns: ["銘柄固有の分析データはまだありません。"],
    horizonScores: neutralHorizonScores,
    evidence: [
      { category: "prices", status: "missing" },
      { category: "financials", status: "missing" },
      { category: "competitors", status: "missing" },
      { category: "orderBook", status: "missing" },
      { category: "statements", status: "missing" },
      { category: "events", status: "missing" },
    ],
  };
}

export function getResearchOutlook(symbol: string): ResearchOutlook {
  const normalizedSymbol = normalizeSymbol(symbol);
  return SAMPLE_OUTLOOKS[normalizedSymbol] ?? createNeutralSampleOutlook(normalizedSymbol);
}

export function calculateEvidenceCompleteness(
  evidence: readonly Pick<ResearchEvidence, "category" | "status">[]
): number {
  if (evidence.length === 0) {
    return 0;
  }

  const currentCount = evidence.filter(({ status }) => status === "current").length;
  return Math.round((currentCount / evidence.length) * 100);
}

const downsideRiskRank: Record<HorizonScore["downsideRisk"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface PortfolioSampleOutlookSummary {
  readonly positiveProbability: number;
  readonly downsideRisk: HorizonScore["downsideRisk"];
  readonly holdingCount: number;
  readonly method: "equal-weighted-holdings";
}

export function summarizePortfolioSampleOutlook(
  outlooks: readonly ResearchOutlook[],
  horizon: OutlookHorizon
): PortfolioSampleOutlookSummary | null {
  if (outlooks.length === 0) return null;

  const scores = outlooks.map((outlook) => outlook.horizonScores[horizon]);
  const positiveProbability = Math.round(
    scores.reduce((total, score) => total + score.positiveProbability, 0) / scores.length
  );
  const downsideRisk = scores.reduce<HorizonScore["downsideRisk"]>(
    (highest, score) =>
      downsideRiskRank[score.downsideRisk] > downsideRiskRank[highest]
        ? score.downsideRisk
        : highest,
    "low"
  );

  return {
    positiveProbability,
    downsideRisk,
    holdingCount: scores.length,
    method: "equal-weighted-holdings",
  };
}
