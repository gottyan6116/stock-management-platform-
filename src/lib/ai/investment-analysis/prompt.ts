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

Write every text field in the JSON response (executiveSummary, rating, thesis, triggers, strengths, weaknesses, all four assessment fields, dataGaps) in natural Japanese (日本語), regardless of what language the supplied evidence is written in — the reader of this analysis is a Japanese-speaking investor.

The "# Data Coverage" section in the user message tells you, per category, whether any evidence exists at all (1) or none does (0). For any category at 0, you MUST NOT write as if you evaluated it — state explicitly in the relevant field that this category has no data connected yet (e.g. "経営者の発言データは未接続のため評価できません"), rather than writing generic filler or staying silent about the gap. Also list every such category in "dataGaps".

Each of the four assessment fields must draw primarily from a DIFFERENT evidence category and must not restate the same facts as the others:
- managementAssessment: primarily from "# Management Statements" (what management themselves said).
- financialAssessment: primarily from "# Financial Metrics" and the Deterministic Quantitative Score section — cite actual figures and, where at least two periods of the same metric exist, the trend between them.
- valuationAssessment: primarily from "# Market Snapshot" (price, trailing PER, dividend yield) plus any per/pbr/ev_ebitda entries in "# Financial Metrics".
- competitiveAssessment: primarily from any competition-related content in "# Catalysts", "# Risks", or "# Imported Research Reports" — if none of those mention competitive positioning, say so explicitly rather than inventing a competitive assessment.

The Deterministic Quantitative Score and your own mediumTerm/longTerm scores are DIFFERENT axes, not the same number on two scales — do not assume they should numerically match:
- The Deterministic Quantitative Score is a fixed, code-computed score from financial ratios only (0 to the stated max), with no judgment involved — it can be low simply because few ratios are registered yet, not necessarily because the company is weak.
- mediumTerm.score and longTerm.score are your own holistic 0-100 judgment, informed by the quant score plus everything else (management commentary, catalysts, risks, qualitative evidence). Explain in your theses how the two relate for this company (e.g. "定量スコアは登録データが少なく低いが、経営陣の発言や成長機会を踏まえると長期的な評価は妥当と考えられる").

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

function summarizeList<T>(label: string, items: readonly T[], render: (item: T) => string): string {
  if (items.length === 0) return `${label}: no data`;
  return `${label} (${items.length}):\n` + items.map((item) => `- ${render(item)}`).join("\n");
}

/** source_id -> "S3(official_ir/fact)" のような短いタグを引けるマップを作る。未設定/該当なしは呼び出し側でハンドリング。 */
function buildSourceTagLookup(sources: InvestmentEvidence["sources"]): Map<string, string> {
  const tags = new Map<string, string>();
  sources.forEach((source, index) => {
    tags.set(source.id, `S${index + 1}(${source.sourceType}/${source.evidenceClass})`);
  });
  return tags;
}

function sourceTag(sourceId: string | null, tags: Map<string, string>): string {
  if (!sourceId) return "";
  const tag = tags.get(sourceId);
  return tag ? ` [source: ${tag}]` : "";
}

// 「貼り付け」モードの取り込みは要約(summary)を持たないため、原文(raw_content)からの抜粋を
// 分析プロンプトに含める。ここで切り詰めるのは、1件で数十KBに及ぶ貼り付けが
// プロンプト全体のトークン予算を圧迫しないようにするため（本文自体はDBに全文保存済み）。
const RAW_CONTENT_EXCERPT_LIMIT = 4000;

function excerptRawContent(rawContent: string): string | null {
  const trimmed = rawContent.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= RAW_CONTENT_EXCERPT_LIMIT) return trimmed;
  return `${trimmed.slice(0, RAW_CONTENT_EXCERPT_LIMIT)}\n...(truncated, ${trimmed.length - RAW_CONTENT_EXCERPT_LIMIT} more characters not shown)`;
}

export function buildUserPrompt(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): string {
  const parts: string[] = [];
  const sourceTags = buildSourceTagLookup(evidence.sources);

  parts.push(`# Company\n${evidence.company.name} (${evidence.company.providerSymbol}, ${evidence.company.exchange ?? "unknown exchange"}, ${evidence.company.market}, ${evidence.company.currency})`);
  parts.push(`# Market Snapshot\nPrice date: ${evidence.market.priceDate ?? "unknown"}\nClose: ${evidence.market.close ?? "no data"}\nChange: ${evidence.market.changePercent ?? "no data"}%\nDividend yield: ${evidence.market.dividendYield ?? "no data"}\nTrailing PER: ${evidence.market.trailingPE ?? "no data"}`);
  parts.push(
    evidence.sources.length === 0
      ? "# Sources: no data"
      : `# Sources (evidenceClass tells you whether an item below is a directly-stated FACT, a third-party OPINION, or an AI-generated INTERPRETATION from an imported report — weigh accordingly) (${evidence.sources.length}):\n` +
          evidence.sources
            .map(
              (s, i) =>
                `- S${i + 1}: ${s.sourceName} (${s.sourceType}, evidenceClass=${s.evidenceClass}${s.reliability ? `, reliability=${s.reliability}` : ""})`
            )
            .join("\n")
  );
  parts.push(
    summarizeList(
      "# Financial Metrics",
      evidence.financials,
      (m) => `${m.metricKey}=${m.value} (${m.periodType} ending ${m.periodEnd}${m.isManual ? ", manually entered" : ""})${sourceTag(m.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList(
      "# Management Statements",
      evidence.managementStatements,
      (m) => `[${m.topic}] ${m.personName}${m.role ? ` (${m.role})` : ""}: "${m.statement}"${m.statementDate ? ` (${m.statementDate})` : ""}${sourceTag(m.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList(
      "# Catalysts",
      evidence.catalysts,
      (c) => `${c.description}${c.expectedTiming ? ` (expected ${c.expectedTiming})` : ""}${c.impact ? ` [impact: ${c.impact}]` : ""}${sourceTag(c.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList(
      "# Risks",
      evidence.risks,
      (r) => `[${r.riskType}] ${r.description}${r.severity ? ` (severity: ${r.severity})` : ""}${sourceTag(r.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList(
      "# Events",
      evidence.events,
      (e) => `[${e.eventType}] ${e.title} (${e.eventDate})${e.description ? `: ${e.description}` : ""}${sourceTag(e.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList(
      "# Investor/Analyst Opinions",
      evidence.opinions,
      (o) => `${o.author}${o.organization ? ` (${o.organization})` : ""}: ${o.summary}${o.rating !== null ? ` [rating: ${o.rating}]` : ""}${sourceTag(o.sourceId, sourceTags)}`
    )
  );
  parts.push(
    summarizeList("# Imported Research Reports", evidence.research, (r) => {
      const header = `${r.sourceName ?? "unknown source"} (${r.sourceType ?? "unknown type"}, ${r.researchDate ?? r.importedAt})`;
      if (r.summary) return `${header}: ${r.summary}`;
      const excerpt = excerptRawContent(r.rawContent);
      return excerpt
        ? `${header} [UNSTRUCTURED PASTED TEXT — not yet reviewed or fact-checked by a human, extract only what is clearly stated and treat cautiously]:\n${excerpt}`
        : `${header}: no content`;
    })
  );
  parts.push(
    `# Data Coverage\n${JSON.stringify(evidence.dataCoverage)}`
  );
  parts.push(
    `# Deterministic Quantitative Score (computed by code, not by you — use as context)\nTotal: ${quantScore.total ?? "not computable"} / ${quantScore.maxTotal} (scored out of ${quantScore.scoredMaxTotal ?? "n/a"} where data existed)\nGrowth: ${quantScore.growth.score ?? "no data"} — ${quantScore.growth.reason}\nProfitability: ${quantScore.profitability.score ?? "no data"} — ${quantScore.profitability.reason}\nFinancial Health: ${quantScore.financialHealth.score ?? "no data"} — ${quantScore.financialHealth.reason}\nCash Flow: ${quantScore.cashFlow.score ?? "no data"} — ${quantScore.cashFlow.reason}\nValuation: ${quantScore.valuation.score ?? "no data"} — ${quantScore.valuation.reason}\nShareholder Return: ${quantScore.shareholderReturn.score ?? "no data"} — ${quantScore.shareholderReturn.reason}`
  );
  return parts.join("\n\n");
}
