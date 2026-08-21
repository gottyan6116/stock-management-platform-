import { z } from "zod";

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
 * モデルの生テキスト出力からJSON本体を取り出してZod検証する。
 * LLMはJSON前後に説明文やmarkdownのコードフェンス（```json ... ```）を付けることがあるため、
 * 最初の '{' から最後の '}' までを抽出してからパースする。
 */
export function parseAnalysisResponse(rawText: string): InvestmentAnalysisResult {
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(`AI response contained no JSON object: ${rawText.slice(0, 200)}`);
  }
  const jsonText = rawText.slice(firstBrace, lastBrace + 1);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`AI response JSON could not be parsed: ${(err as Error).message}`);
  }

  const result = InvestmentAnalysisResultSchema.safeParse(parsedJson);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(`AI response failed schema validation at "${firstIssue?.path.join(".")}": ${firstIssue?.message}`);
  }
  return result.data;
}
