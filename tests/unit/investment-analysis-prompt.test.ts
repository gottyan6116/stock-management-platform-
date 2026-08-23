import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/investment-analysis/prompt";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import { computeQuantScore } from "@/lib/scoring/quant-score";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";

const company: CompanySnapshot = {
  instrumentId: "inst-1",
  providerSymbol: "6758.T",
  name: "Sony Group Corporation",
  exchange: "Tokyo",
  market: "JP",
  currency: "JPY",
  sector: null,
  industry: null,
};
const market: MarketSnapshot = {
  priceDate: "2026-08-20",
  close: 3785,
  previousClose: 3777,
  change: 8,
  changePercent: 0.21,
  dividendYield: 0.93,
  trailingPE: 20.29,
  marketCap: null,
};

describe("buildSystemPrompt", () => {
  it("instructs the model to use only supplied evidence and not predict a stock price", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/evidence/i);
    expect(prompt).toMatch(/do not predict/i);
    expect(prompt).toMatch(/medium-term/i);
    expect(prompt).toMatch(/long-term/i);
  });
});

describe("buildUserPrompt", () => {
  it("embeds the company name and quant score total in the prompt text", () => {
    const evidence = buildInvestmentEvidence({
      company,
      market,
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      events: [],
      opinions: [],
      research: [],
    });
    const quantScore = computeQuantScore(evidence.financials);
    const prompt = buildUserPrompt(evidence, quantScore);
    expect(prompt).toContain("Sony Group Corporation");
    expect(prompt).toContain("6758.T");
  });

  it("mentions when a category has no data rather than omitting it silently", () => {
    const evidence = buildInvestmentEvidence({
      company,
      market,
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      events: [],
      opinions: [],
      research: [],
    });
    const quantScore = computeQuantScore(evidence.financials);
    const prompt = buildUserPrompt(evidence, quantScore);
    expect(prompt.toLowerCase()).toMatch(/no data|none|empty/);
  });

  it("includes a raw-content excerpt for paste_text reports with no summary (regression: unstructured pasted research must reach the AI)", () => {
    const evidence = buildInvestmentEvidence({
      company,
      market,
      sources: [],
      financials: [],
      managementStatements: [],
      catalysts: [],
      risks: [],
      events: [],
      opinions: [],
      research: [
        {
          id: "r1",
          importMode: "paste_text",
          researchDate: null,
          researchModel: null,
          summary: null,
          rawContent: "NTTの2026年度1Q決算は営業収益+10.9%、営業利益+4.9%で増収増益だった。",
          importedAt: "2026-08-20T00:00:00Z",
          sourceName: "ChatGPT",
          sourceType: "chatgpt",
        },
      ],
    });
    const quantScore = computeQuantScore(evidence.financials);
    const prompt = buildUserPrompt(evidence, quantScore);
    expect(prompt).toContain("NTTの2026年度1Q決算");
    expect(prompt).toContain("UNSTRUCTURED PASTED TEXT");
  });

  it("renders sources with evidenceClass and tags evidence items back to their source (regression: provenance must reach the AI)", () => {
    const evidence = buildInvestmentEvidence({
      company,
      market,
      sources: [
        {
          id: "src-1",
          instrumentId: "inst-1",
          sourceType: "official_ir",
          sourceName: "FY2026 Q1 Earnings Presentation",
          sourceUrl: null,
          evidenceClass: "fact",
          reliability: "high",
          researchedAt: null,
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
      financials: [],
      managementStatements: [
        {
          id: "ms-1",
          instrumentId: "inst-1",
          personName: "Hiroki Totoki",
          role: "President and COO",
          statement: "We expect continued growth in the Game & Network Services segment.",
          statementDate: "2026-08-05",
          topic: "guidance",
          sourceId: "src-1",
          sourceReportId: null,
          page: null,
          confidence: "high",
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
      catalysts: [],
      risks: [],
      events: [],
      opinions: [],
      research: [],
    });
    const quantScore = computeQuantScore(evidence.financials);
    const prompt = buildUserPrompt(evidence, quantScore);
    expect(prompt).toContain("evidenceClass=fact");
    expect(prompt).toContain("FY2026 Q1 Earnings Presentation");
    // The management statement line should reference the source by its S-tag, not just list it separately.
    expect(prompt).toMatch(/Totoki.*\[source: S1/s);
  });
});
