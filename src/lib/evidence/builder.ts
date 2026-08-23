import type {
  CompanyCatalyst,
  CompanyEvent,
  CompanyRisk,
  FinancialMetric,
  ManagementStatement,
  ResearchOpinion,
  ResearchSource,
} from "@/types/evidence";
import type { ResearchReportSummary } from "@/server/repositories/evidence-repository";
import type { Market, Currency } from "@/types/domain";

// CompanySnapshot/MarketSnapshotはsrc/types/domain.tsのInstrument/Quoteと似ているが、
// あえて別型として定義している。evidenceパケットの形をmarket-dataドメイン型の変化から
// 切り離すため（呼び出し側がInstrument/Quoteからこの形へ詰め替える想定）。
export interface CompanySnapshot {
  instrumentId: string;
  providerSymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  sector: string | null;
  industry: string | null;
}

export interface MarketSnapshot {
  priceDate: string | null;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  trailingPE: number | null;
  marketCap: number | null;
}

export interface DataCoverage {
  financials: number;
  management: number;
  catalysts: number;
  risks: number;
  events: number;
  opinions: number;
  research: number;
  overall: number;
}

export interface InvestmentEvidence {
  company: CompanySnapshot;
  market: MarketSnapshot;
  sources: ResearchSource[];
  financials: FinancialMetric[];
  managementStatements: ManagementStatement[];
  catalysts: CompanyCatalyst[];
  risks: CompanyRisk[];
  events: CompanyEvent[];
  opinions: ResearchOpinion[];
  research: ResearchReportSummary[];
  dataCoverage: DataCoverage;
  generatedAt: string;
}

export interface BuildEvidenceInput {
  company: CompanySnapshot;
  market: MarketSnapshot;
  sources: ResearchSource[];
  financials: FinancialMetric[];
  managementStatements: ManagementStatement[];
  catalysts: CompanyCatalyst[];
  risks: CompanyRisk[];
  events: CompanyEvent[];
  opinions: ResearchOpinion[];
  research: ResearchReportSummary[];
}

function coverageOf(count: number): number {
  return count > 0 ? 1 : 0;
}

/**
 * 各カテゴリの「データがあるかどうか」を0/1で示す単純なカバレッジ指標。
 * 将来的に件数や新しさで重み付けする場合もこの関数の戻り値の意味（missing=0）は変えないこと。
 */
function computeDataCoverage(input: BuildEvidenceInput): DataCoverage {
  const financials = coverageOf(input.financials.length);
  const management = coverageOf(input.managementStatements.length);
  const catalysts = coverageOf(input.catalysts.length);
  const risks = coverageOf(input.risks.length);
  const events = coverageOf(input.events.length);
  const opinions = coverageOf(input.opinions.length);
  // summaryもraw_contentも空のレポート（理論上は起きないはずだが防御的に）だけを
  // 「実質的に読める内容がない」として除外する。buildUserPromptはsummaryが無くても
  // raw_contentの抜粋をAIへ渡せるため、paste_textモードの取り込みもカバレッジに含めてよい。
  const research = coverageOf(input.research.filter((r) => r.summary !== null || r.rawContent.trim().length > 0).length);
  const categories = [financials, management, catalysts, risks, events, opinions, research];
  const overall = categories.reduce((sum, value) => sum + value, 0) / categories.length;
  return { financials, management, catalysts, risks, events, opinions, research, overall };
}

/** 銘柄1件分の全evidenceを1つのパケットに組み立てる純粋関数。DBアクセスは呼び出し側の責務。 */
export function buildInvestmentEvidence(input: BuildEvidenceInput): InvestmentEvidence {
  return {
    company: input.company,
    market: input.market,
    sources: input.sources,
    financials: input.financials,
    managementStatements: input.managementStatements,
    catalysts: input.catalysts,
    risks: input.risks,
    events: input.events,
    opinions: input.opinions,
    research: input.research,
    dataCoverage: computeDataCoverage(input),
    generatedAt: new Date().toISOString(),
  };
}
