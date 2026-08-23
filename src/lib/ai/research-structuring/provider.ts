import type { ResearchImportInput } from "@/lib/evidence/schemas";

export interface StructuringInput {
  rawContent: string;
  company: { ticker: string; name: string; exchange: string };
  researchDate: string;
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
      sources: [],
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
