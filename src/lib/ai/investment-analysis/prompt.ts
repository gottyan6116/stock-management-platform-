import type { InvestmentEvidence } from "@/lib/evidence/builder";
import type { QuantScoreBreakdown } from "@/lib/scoring/quant-score";

export function buildSystemPrompt(): string {
  return `You are an investment research analyst.

Analyze ONLY the evidence supplied in the user message below. Do not introduce facts that are absent from the supplied evidence, and do not rely on your own pretrained knowledge about this specific company beyond what is given here.

Clearly separate in your reasoning:
1. fact (directly stated in the supplied evidence)
2. interpretation (your reasoning connecting facts)
3. uncertainty (where the evidence is insufficient or conflicting)

If evidence is insufficient for a judgment on some aspect, say so explicitly in "dataGaps" rather than guessing or filling the gap from general knowledge.

Do NOT predict a specific future stock price or price target.

Evaluate the company for medium-term (1-3 year) ownership and long-term (3-5+ year) ownership SEPARATELY — they can differ.

Your score is a research indicator reflecting the strength and quality of the supplied evidence, not a guarantee of future returns.

Respond with ONLY a single JSON object, no markdown code fences, no explanation before or after the JSON, matching exactly this shape:
{
  "executiveSummary": string,
  "mediumTerm": { "score": number (0-100), "rating": string, "thesis": string },
  "longTerm": { "score": number (0-100), "rating": string, "thesis": string },
  "bullCase": { "thesis": string, "triggers": string[] },
  "baseCase": { "thesis": string, "triggers": string[] },
  "bearCase": { "thesis": string, "triggers": string[] },
  "strengths": string[],
  "weaknesses": string[],
  "managementAssessment": string,
  "financialAssessment": string,
  "valuationAssessment": string,
  "competitiveAssessment": string,
  "dataGaps": string[],
  "confidence": number (0-100, your confidence in this analysis given the evidence quality)
}`;
}

function summarizeList(label: string, items: readonly unknown[], render: (item: any) => string): string {
  if (items.length === 0) return `${label}: no data`;
  return `${label} (${items.length}):\n` + items.map((item) => `- ${render(item)}`).join("\n");
}

export function buildUserPrompt(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): string {
  const parts: string[] = [];
  parts.push(`# Company\n${evidence.company.name} (${evidence.company.providerSymbol}, ${evidence.company.exchange ?? "unknown exchange"}, ${evidence.company.market}, ${evidence.company.currency})`);
  parts.push(`# Market Snapshot\nPrice date: ${evidence.market.priceDate ?? "unknown"}\nClose: ${evidence.market.close ?? "no data"}\nChange: ${evidence.market.changePercent ?? "no data"}%\nDividend yield: ${evidence.market.dividendYield ?? "no data"}\nTrailing PER: ${evidence.market.trailingPE ?? "no data"}`);
  parts.push(
    summarizeList("# Financial Metrics", evidence.financials, (m) => `${m.metricKey}=${m.value} (${m.periodType} ending ${m.periodEnd}${m.isManual ? ", manually entered" : ""})`)
  );
  parts.push(
    summarizeList("# Management Statements", evidence.managementStatements, (m) => `[${m.topic}] ${m.personName}${m.role ? ` (${m.role})` : ""}: "${m.statement}"${m.statementDate ? ` (${m.statementDate})` : ""}`)
  );
  parts.push(summarizeList("# Catalysts", evidence.catalysts, (c) => `${c.description}${c.expectedTiming ? ` (expected ${c.expectedTiming})` : ""}${c.impact ? ` [impact: ${c.impact}]` : ""}`));
  parts.push(summarizeList("# Risks", evidence.risks, (r) => `[${r.riskType}] ${r.description}${r.severity ? ` (severity: ${r.severity})` : ""}`));
  parts.push(summarizeList("# Events", evidence.events, (e) => `[${e.eventType}] ${e.title} (${e.eventDate})${e.description ? `: ${e.description}` : ""}`));
  parts.push(summarizeList("# Investor/Analyst Opinions", evidence.opinions, (o) => `${o.author}${o.organization ? ` (${o.organization})` : ""}: ${o.summary}${o.rating !== null ? ` [rating: ${o.rating}]` : ""}`));
  parts.push(summarizeList("# Imported Research Reports", evidence.research, (r) => `${r.sourceName ?? "unknown source"} (${r.sourceType ?? "unknown type"}, ${r.researchDate ?? r.importedAt}): ${r.summary ?? "no summary"}`));
  parts.push(
    `# Data Coverage\n${JSON.stringify(evidence.dataCoverage)}`
  );
  parts.push(
    `# Deterministic Quantitative Score (computed by code, not by you — use as context)\nTotal: ${quantScore.total ?? "not computable"} / ${quantScore.maxTotal} (scored out of ${quantScore.scoredMaxTotal ?? "n/a"} where data existed)\nGrowth: ${quantScore.growth.score ?? "no data"} — ${quantScore.growth.reason}\nProfitability: ${quantScore.profitability.score ?? "no data"} — ${quantScore.profitability.reason}\nFinancial Health: ${quantScore.financialHealth.score ?? "no data"} — ${quantScore.financialHealth.reason}\nCash Flow: ${quantScore.cashFlow.score ?? "no data"} — ${quantScore.cashFlow.reason}\nValuation: ${quantScore.valuation.score ?? "no data"} — ${quantScore.valuation.reason}\nShareholder Return: ${quantScore.shareholderReturn.score ?? "no data"} — ${quantScore.shareholderReturn.reason}`
  );
  return parts.join("\n\n");
}
