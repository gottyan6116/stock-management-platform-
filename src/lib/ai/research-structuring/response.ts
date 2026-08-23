import { ResearchImportSchema, type ResearchImportInput } from "@/lib/evidence/schemas";
import { extractJsonFromAiResponse } from "@/lib/ai/extract-json";

export function parseStructuringResponse(raw: unknown): ResearchImportInput {
  const parsedJson = extractJsonFromAiResponse(raw);
  const result = ResearchImportSchema.safeParse(parsedJson);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(
      `AI structuring response failed schema validation at "${firstIssue?.path.join(".")}": ${firstIssue?.message}`
    );
  }
  return result.data;
}
