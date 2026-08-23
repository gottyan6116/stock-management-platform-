import { z } from "zod";
import { extractJsonFromAiResponse } from "@/lib/ai/extract-json";

const caseSchema = z.object({
  thesis: z.string().min(1),
  triggers: z.array(z.string()),
});

export const InvestmentAnalysisResultSchema = z.object({
  executiveSummary: z.string().min(1),
  mediumTerm: z.object({
    score: z.number().min(0).max(100),
    rating: z.string().min(1),
    thesis: z.string().min(1),
  }),
  longTerm: z.object({
    score: z.number().min(0).max(100),
    rating: z.string().min(1),
    thesis: z.string().min(1),
  }),
  bullCase: caseSchema,
  baseCase: caseSchema,
  bearCase: caseSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  managementAssessment: z.string(),
  financialAssessment: z.string(),
  valuationAssessment: z.string(),
  competitiveAssessment: z.string(),
  dataGaps: z.array(z.string()),
  confidence: z.number().min(0).max(100),
});
export type InvestmentAnalysisResult = z.infer<typeof InvestmentAnalysisResultSchema>;

/**
 * モデルの生出力をZod検証する。JSON抽出自体は共通ヘルパー（extractJsonFromAiResponse）に委譲する。
 */
export function parseAnalysisResponse(raw: unknown): InvestmentAnalysisResult {
  const parsedJson = extractJsonFromAiResponse(raw);
  const result = InvestmentAnalysisResultSchema.safeParse(parsedJson);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(`AI response failed schema validation at "${firstIssue?.path.join(".")}": ${firstIssue?.message}`);
  }
  return result.data;
}
