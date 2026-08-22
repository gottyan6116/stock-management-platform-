import type { InvestmentEvidence } from "@/lib/evidence/builder";
import type { QuantScoreBreakdown } from "@/lib/scoring/quant-score";
import type { InvestmentAnalysisResult } from "./response";

export interface InvestmentAnalysisProvider {
  analyzeInvestment(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): Promise<InvestmentAnalysisResult>;
  readonly modelName: string;
}

/** テスト・ANALYSIS_PROVIDER=mock時に使う決定的なダミープロバイダー。実APIは一切呼ばない。 */
export class MockInvestmentAnalysisProvider implements InvestmentAnalysisProvider {
  readonly modelName = "mock";

  async analyzeInvestment(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): Promise<InvestmentAnalysisResult> {
    return {
      executiveSummary: `[MOCK] Analysis for ${evidence.company.name} based on ${evidence.financials.length} financial metrics.`,
      mediumTerm: { score: 50, rating: "Neutral", thesis: "[MOCK] Placeholder medium-term thesis." },
      longTerm: { score: 50, rating: "Neutral", thesis: "[MOCK] Placeholder long-term thesis." },
      bullCase: { thesis: "[MOCK] Bull case placeholder.", triggers: [] },
      baseCase: { thesis: "[MOCK] Base case placeholder.", triggers: [] },
      bearCase: { thesis: "[MOCK] Bear case placeholder.", triggers: [] },
      strengths: [],
      weaknesses: [],
      managementAssessment: "[MOCK]",
      financialAssessment: `[MOCK] Quant total: ${quantScore.total ?? "n/a"}`,
      valuationAssessment: "[MOCK]",
      competitiveAssessment: "[MOCK]",
      dataGaps: ["This is a mock result; no real AI analysis was performed."],
      confidence: 0,
    };
  }
}
