import { metricKeyValues, sourceTypeValues, statementTopicValues, eventTypeValues } from "@/lib/evidence/schemas";
import type { StructuringInput } from "./provider";

export function buildStructuringSystemPrompt(): string {
  return `You are a research-extraction assistant. You extract structured facts from a piece of text about a public company. You do not analyze, judge, recommend, or predict anything — extraction only.

Rules:
1. Never fabricate a number or fact. If a value is not clearly stated in the text, omit that entry entirely rather than guessing or using 0 as a placeholder.
2. Do not use general knowledge about the company beyond what is in the supplied text.
3. Every date must be a real calendar date in YYYY-MM-DD format. If only a partial date is known (e.g. "sometime in 2023"), omit that entry rather than guessing a day.
4. financials[].metricKey must be exactly one of these values (no others are accepted): ${metricKeyValues.join(", ")}. If a number in the text does not map to one of these (e.g. segment-level revenue, a scenario-based price target), leave it out of financials and mention it in "summary" instead.
5. sources[].sourceType must be exactly one of these values (no others are accepted): ${sourceTypeValues.join(", ")}. You are always told the known source of the text itself (see "Known Source" below) — always include exactly one source entry with sourceKey "primary" using that exact sourceName and sourceType verbatim, do not reclassify it based on what the text discusses. Only add additional source entries if the text explicitly quotes or cites a different, specifically-named source (e.g. "according to the Q1 earnings call...").
6. managementStatements[].topic must be exactly one of these values (no others are accepted): ${statementTopicValues.join(", ")}; use "other" if nothing else fits.
7. events[].eventType must be exactly one of these values (no others are accepted): ${eventTypeValues.join(", ")}; use "other" if nothing else fits.
8. periodType is "FY" (full fiscal year) or "Q" (quarter). periodStart/periodEnd are that period's start/end dates.
9. Give every source you use a short unique sourceKey, and reference it from each item you extract via that item's own sourceKey field, so the origin of every fact is traceable.
10. Respond with ONLY a single JSON object, no markdown code fences, no explanation before or after the JSON, matching exactly this shape:
{
  "company": { "ticker": string, "name": string, "exchange": string },
  "researchDate": string (YYYY-MM-DD),
  "sources": [{ "sourceKey": string, "sourceType": string, "sourceName": string, "sourceUrl"?: string, "evidenceClass"?: "fact"|"opinion"|"ai_interpretation", "reliability"?: "low"|"medium"|"high" }],
  "financials": [{ "sourceKey"?: string, "metricKey": string, "value": number, "unit"?: string, "currency"?: "JPY"|"USD", "periodType": "FY"|"Q", "periodStart": string, "periodEnd": string }],
  "managementStatements": [{ "sourceKey"?: string, "personName": string, "role"?: string, "statement": string, "statementDate"?: string, "topic": string }],
  "catalysts": [{ "sourceKey"?: string, "description": string, "expectedTiming"?: string, "impact"?: "low"|"medium"|"high" }],
  "risks": [{ "sourceKey"?: string, "riskType": string, "description": string, "severity"?: "low"|"medium"|"high" }],
  "investorOpinions": [{ "sourceKey"?: string, "author": string, "organization"?: string, "summary": string, "publishedAt"?: string }],
  "events": [{ "sourceKey"?: string, "eventType": string, "title": string, "description"?: string, "eventDate": string }],
  "summary": string
}`;
}

export function buildStructuringUserPrompt(input: StructuringInput): string {
  return `# Company
${input.company.name} (${input.company.ticker}, ${input.company.exchange})

# Research Date
${input.researchDate}

# Known Source
The text below was sourced from: sourceName="${input.knownSource.sourceName}", sourceType="${input.knownSource.sourceType}". Use this verbatim for the "primary" source entry (see system rules).

# Text to extract from
${input.rawContent}`;
}
