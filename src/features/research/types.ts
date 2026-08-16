export type ResearchDataKind = "sample" | "live" | "unavailable";
export type OutlookHorizon = "1y" | "3y";
export type OutlookAction = "hold" | "watch" | "review";
export type EvidenceStatus = "current" | "stale" | "missing";
export type EvidenceCategory =
  "prices" | "financials" | "competitors" | "orderBook" | "statements" | "events";

export interface ResearchEvidence {
  readonly category: EvidenceCategory;
  readonly status: EvidenceStatus;
  readonly detail?: string;
}

export interface HorizonScore {
  readonly horizon: OutlookHorizon;
  readonly positiveProbability: number;
  readonly benchmarkOutperformanceProbability: number | null;
  readonly expectedReturnRange: {
    readonly minPercent: number;
    readonly maxPercent: number;
  } | null;
  readonly downsideRisk: "low" | "medium" | "high";
  readonly evidenceStrength: number;
  readonly action: OutlookAction;
}

export interface ResearchOutlook {
  readonly symbol: string;
  readonly dataKind: ResearchDataKind;
  readonly sampleLabel: string;
  readonly source: string;
  readonly modelVersion: string;
  readonly updatedAt: string | null;
  readonly positiveFactors: readonly string[];
  readonly cautionFactors: readonly string[];
  readonly unknowns: readonly string[];
  readonly horizonScores: Readonly<Record<OutlookHorizon, HorizonScore>>;
  readonly evidence: readonly ResearchEvidence[];
}
