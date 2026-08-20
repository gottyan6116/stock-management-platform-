export type SourceType =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "perplexity"
  | "official_ir"
  | "edinet"
  | "sec"
  | "analyst"
  | "investor"
  | "news"
  | "manual"
  | "other";

export type EvidenceClass = "fact" | "opinion" | "ai_interpretation";
export type ImportMode = "paste_text" | "json" | "manual_form";
export type ConfidenceLevel = "low" | "medium" | "high";

export type StatementTopic =
  | "guidance"
  | "strategy"
  | "margin"
  | "capital_allocation"
  | "m_and_a"
  | "ai"
  | "product"
  | "international"
  | "shareholder_return"
  | "risk"
  | "competition"
  | "other";

export type EventType =
  | "earnings"
  | "guidance"
  | "m_and_a"
  | "buyback"
  | "dividend"
  | "capital_raise"
  | "product"
  | "regulation"
  | "lawsuit"
  | "management_change"
  | "restructuring"
  | "partnership"
  | "other";

export type PeriodType = "FY" | "Q";
export type AnalysisStatus = "pending" | "success" | "failed";

// 定量スコアリング（src/lib/scoring）が参照する既知のmetric key。
// DBのmetric_keyはtext型（自由入力を禁止し、常にこのunionでZod検証する）。
export type MetricKey =
  | "revenue"
  | "operating_income"
  | "net_income"
  | "eps"
  | "fcf"
  | "cash"
  | "debt"
  | "roe"
  | "roic"
  | "operating_margin"
  | "net_margin"
  | "per"
  | "pbr"
  | "ev_ebitda"
  | "dividend_yield"
  | "dividend_payout"
  | "current_ratio"
  | "net_debt"
  | "net_debt_ebitda"
  | "fcf_yield"
  | "fcf_margin";

export interface ResearchSource {
  id: string;
  instrumentId: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  evidenceClass: EvidenceClass;
  reliability: ConfidenceLevel | null;
  researchedAt: string | null;
  createdAt: string;
}

export interface ResearchReport {
  id: string;
  instrumentId: string;
  sourceId: string | null;
  importMode: ImportMode;
  researchDate: string | null;
  originalQuery: string | null;
  researchModel: string | null;
  rawContent: string;
  structuredJson: Record<string, unknown> | null;
  summary: string | null;
  userNotes: string | null;
  importedAt: string;
}

export interface FinancialMetric {
  id: string;
  instrumentId: string;
  metricKey: MetricKey;
  value: number;
  unit: string | null;
  currency: "JPY" | "USD" | null;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  reportedAt: string | null;
  sourceId: string | null;
  sourceReportId: string | null;
  isManual: boolean;
  createdAt: string;
}

export interface ManagementStatement {
  id: string;
  instrumentId: string;
  personName: string;
  role: string | null;
  statement: string;
  statementDate: string | null;
  topic: StatementTopic;
  sourceId: string | null;
  sourceReportId: string | null;
  page: number | null;
  confidence: ConfidenceLevel | null;
  createdAt: string;
}

export interface ResearchOpinion {
  id: string;
  instrumentId: string;
  author: string;
  organization: string | null;
  stance: string | null;
  summary: string;
  rating: number | null;
  targetPrice: number | null;
  publishedAt: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  reliability: ConfidenceLevel | null;
  createdAt: string;
}

export interface CompanyEvent {
  id: string;
  instrumentId: string;
  eventType: EventType;
  title: string;
  description: string | null;
  eventDate: string;
  sourceId: string | null;
  sourceReportId: string | null;
  createdAt: string;
}

export interface CompanyRisk {
  id: string;
  instrumentId: string;
  riskType: string;
  description: string;
  severity: ConfidenceLevel | null;
  likelihood: ConfidenceLevel | null;
  sourceId: string | null;
  detectedAt: string | null;
  createdAt: string;
}

export interface CompanyCatalyst {
  id: string;
  instrumentId: string;
  catalystType: string | null;
  description: string;
  expectedTiming: string | null;
  impact: ConfidenceLevel | null;
  sourceId: string | null;
  sourceReportId: string | null;
  createdAt: string;
}

export interface AnalysisRun {
  id: string;
  instrumentId: string;
  model: string;
  analysisVersion: string;
  scoringVersion: string;
  inputSnapshot: Record<string, unknown>;
  evidenceHash: string;
  quantScore: number | null;
  qualScore: number | null;
  mediumScore: number | null;
  longScore: number | null;
  confidence: number | null;
  resultJson: Record<string, unknown> | null;
  status: AnalysisStatus;
  createdAt: string;
}
