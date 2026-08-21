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
});
