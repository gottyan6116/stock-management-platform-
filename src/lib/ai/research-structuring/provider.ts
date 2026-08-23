import type { ResearchImportInput } from "@/lib/evidence/schemas";
import type { SourceType } from "@/types/evidence";

export interface StructuringInput {
  rawContent: string;
  company: { ticker: string; name: string; exchange: string };
  researchDate: string;
  // 貼り付け時にユーザー自身が申告した情報源。原文の内容（例:「本文でIR資料の数字に言及している」）に
  // AIが引きずられて sourceType を誤分類しないよう、推測させず既知の値をそのまま使わせる。
  knownSource: { sourceName: string; sourceType: SourceType };
}

export interface ResearchStructuringProvider {
  structureResearch(input: StructuringInput): Promise<ResearchImportInput>;
  readonly modelName: string;
}

/** テスト・RESEARCH_STRUCTURING_PROVIDER=mock時に使う決定的なダミープロバイダー。実APIは一切呼ばない。 */
export class MockResearchStructuringProvider implements ResearchStructuringProvider {
  readonly modelName = "mock";

  async structureResearch(input: StructuringInput): Promise<ResearchImportInput> {
    return {
      company: input.company,
      researchDate: input.researchDate,
      sources: [
        { sourceKey: "primary", sourceType: input.knownSource.sourceType, sourceName: input.knownSource.sourceName },
      ],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      investorOpinions: [],
      events: [],
      summary: `[MOCK] Structured summary for ${input.company.name}.`,
    };
  }
}
