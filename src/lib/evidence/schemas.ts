import { z } from "zod";
import type { EventType, MetricKey, SourceType, StatementTopic } from "@/types/evidence";

const sourceTypeValues: [SourceType, ...SourceType[]] = [
  "chatgpt",
  "claude",
  "gemini",
  "perplexity",
  "official_ir",
  "edinet",
  "sec",
  "analyst",
  "investor",
  "news",
  "manual",
  "other",
];

const metricKeyValues: [MetricKey, ...MetricKey[]] = [
  "revenue",
  "operating_income",
  "net_income",
  "eps",
  "fcf",
  "cash",
  "debt",
  "roe",
  "roic",
  "operating_margin",
  "net_margin",
  "per",
  "pbr",
  "ev_ebitda",
  "dividend_yield",
  "dividend_payout",
  "current_ratio",
  "net_debt",
  "net_debt_ebitda",
  "fcf_yield",
  "fcf_margin",
];

const statementTopicValues: [StatementTopic, ...StatementTopic[]] = [
  "guidance",
  "strategy",
  "margin",
  "capital_allocation",
  "m_and_a",
  "ai",
  "product",
  "international",
  "shareholder_return",
  "risk",
  "competition",
  "other",
];

const eventTypeValues: [EventType, ...EventType[]] = [
  "earnings",
  "guidance",
  "m_and_a",
  "buyback",
  "dividend",
  "capital_raise",
  "product",
  "regulation",
  "lawsuit",
  "management_change",
  "restructuring",
  "partnership",
  "other",
];

const confidenceLevelSchema = z.enum(["low", "medium", "high"]);
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine((value) => {
    const parts = value.split("-").map(Number);
    const year = parts[0] ?? NaN;
    const month = parts[1] ?? NaN;
    const day = parts[2] ?? NaN;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "date must be a real calendar date");

export const SourceSchema = z.object({
  sourceKey: z.string().trim().min(1, "sourceKey is required"),
  sourceType: z.enum(sourceTypeValues),
  sourceName: z.string().trim().min(1, "sourceName is required"),
  sourceUrl: z.string().url().optional(),
  evidenceClass: z.enum(["fact", "opinion", "ai_interpretation"]).optional(),
  reliability: confidenceLevelSchema.optional(),
});
export type SourceInput = z.infer<typeof SourceSchema>;

export const FinancialMetricInputSchema = z
  .object({
    sourceKey: z.string().optional(),
    metricKey: z.enum(metricKeyValues),
    value: z.number(),
    unit: z.string().optional(),
    currency: z.enum(["JPY", "USD"]).optional(),
    periodType: z.enum(["FY", "Q"]),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    reportedAt: isoDateSchema.optional(),
  })
  .refine((metric) => metric.periodEnd >= metric.periodStart, {
    message: "periodEnd must not be before periodStart",
    path: ["periodEnd"],
  });
export type FinancialMetricInput = z.infer<typeof FinancialMetricInputSchema>;

export const ManagementStatementInputSchema = z.object({
  sourceKey: z.string().optional(),
  personName: z.string().trim().min(1, "personName is required"),
  role: z.string().optional(),
  statement: z.string().trim().min(1, "statement is required"),
  statementDate: isoDateSchema.optional(),
  topic: z.enum(statementTopicValues),
  page: z.number().int().positive().optional(),
  confidence: confidenceLevelSchema.optional(),
});
export type ManagementStatementInput = z.infer<typeof ManagementStatementInputSchema>;

export const CatalystInputSchema = z.object({
  sourceKey: z.string().optional(),
  catalystType: z.string().optional(),
  description: z.string().trim().min(1, "description is required"),
  expectedTiming: z.string().optional(),
  impact: confidenceLevelSchema.optional(),
});
export type CatalystInput = z.infer<typeof CatalystInputSchema>;

export const RiskInputSchema = z.object({
  sourceKey: z.string().optional(),
  riskType: z.string().trim().min(1, "riskType is required"),
  description: z.string().trim().min(1, "description is required"),
  severity: confidenceLevelSchema.optional(),
  likelihood: confidenceLevelSchema.optional(),
  detectedAt: isoDateSchema.optional(),
});
export type RiskInput = z.infer<typeof RiskInputSchema>;

export const ExternalOpinionInputSchema = z.object({
  sourceKey: z.string().optional(),
  author: z.string().trim().min(1, "author is required"),
  organization: z.string().optional(),
  stance: z.string().optional(),
  summary: z.string().trim().min(1, "summary is required"),
  rating: z.number().optional(),
  targetPrice: z.number().positive().optional(),
  publishedAt: isoDateSchema.optional(),
  sourceUrl: z.string().url().optional(),
});
export type ExternalOpinionInput = z.infer<typeof ExternalOpinionInputSchema>;

export const EventInputSchema = z.object({
  sourceKey: z.string().optional(),
  eventType: z.enum(eventTypeValues),
  title: z.string().trim().min(1, "title is required"),
  description: z.string().optional(),
  eventDate: isoDateSchema,
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const ResearchImportSchema = z
  .object({
    company: z.object({
      ticker: z.string().trim().min(1, "company.ticker is required"),
      name: z.string().trim().min(1, "company.name is required"),
      exchange: z.string().trim().min(1, "company.exchange is required"),
    }),
    researchDate: isoDateSchema,
    sources: z.array(SourceSchema),
    financials: z.array(FinancialMetricInputSchema),
    valuation: z.record(z.string(), z.unknown()).optional(),
    managementStatements: z.array(ManagementStatementInputSchema),
    catalysts: z.array(CatalystInputSchema),
    risks: z.array(RiskInputSchema),
    investorOpinions: z.array(ExternalOpinionInputSchema),
    events: z.array(EventInputSchema),
    summary: z.string().trim().min(1, "summary is required"),
  })
  .superRefine((data, ctx) => {
    const sourceKeys = new Set(data.sources.map((source) => source.sourceKey));
    if (sourceKeys.size !== data.sources.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceKey values in sources must be unique",
        path: ["sources"],
      });
    }
    const evidenceGroups: Array<[string, Array<{ sourceKey?: string }>]> = [
      ["financials", data.financials],
      ["managementStatements", data.managementStatements],
      ["catalysts", data.catalysts],
      ["risks", data.risks],
      ["investorOpinions", data.investorOpinions],
      ["events", data.events],
    ];
    for (const [field, items] of evidenceGroups) {
      items.forEach((item, index) => {
        if (item.sourceKey && !sourceKeys.has(item.sourceKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `sourceKey "${item.sourceKey}" does not match any entry in sources`,
            path: [field, index, "sourceKey"],
          });
        }
      });
    }
  });
export type ResearchImportInput = z.infer<typeof ResearchImportSchema>;
