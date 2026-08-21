# Investment Intelligence — Phase P6: Cloudflare AI Qualitative Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user trigger an AI-generated qualitative investment analysis (executive summary, medium/long-term thesis, bull/base/bear cases, strengths/weaknesses, data gaps, confidence) for one instrument, built **only** from the evidence already stored (Phases P1–P4) plus the deterministic quant score (Phase P5) — never from the model's own pretrained knowledge about the company. Persist the result to `analysis_runs` (Phase P1's schema). This is the final phase of this branch's scope; the polished analysis-results UI (displaying this data) is explicitly Phase P7, out of scope here — this phase delivers the working backend pipeline via one API route.

**Architecture:** `InvestmentAnalysisProvider` interface with two implementations — `MockInvestmentAnalysisProvider` (deterministic, used by default in tests and whenever `ANALYSIS_PROVIDER=mock`) and `CloudflareWorkersAIProvider` (real HTTP call to Cloudflare Workers AI using the account's existing `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`). Response parsing (extracting JSON from the model's text output and validating it against a Zod schema) is split out as a pure function, mirroring this codebase's existing `yahoo-mapper.ts` (pure, tested) / `yahoo/client.ts` (I/O, untested-by-unit-test) split — so the parsing logic gets real test coverage even though the network call itself doesn't.

**Tech Stack:** Same as P1–P5. No new npm dependencies — the Cloudflare call is a plain `fetch`, matching how `yahoo-finance2` is the only external HTTP dependency already in this codebase (no new SDK needed for one REST endpoint).

## Global Constraints

- **The AI must be told, explicitly, in its system prompt, to use only the supplied evidence** — no relying on pretrained knowledge about the specific company, no predicting a specific future stock price, medium-term (1–3yr) and long-term (3–5yr+) evaluated separately, and it must state when evidence is insufficient rather than guess. This is a direct requirement from the project's design brief and is the single most important correctness property of this phase — get the prompt text exactly right, don't paraphrase loosely.
- **Cost control**: nothing in this phase calls the Cloudflare API automatically or on a schedule. The only caller is the new `/api/analysis/run` POST route, which only runs when explicitly invoked (by a human hitting the endpoint — there is no UI trigger yet, that's Phase P7). Do not add polling, cron, or render-time AI calls anywhere.
- **Never call the real Cloudflare API from an automated test.** `MockInvestmentAnalysisProvider` is what `computeQuantScore`-adjacent tests and any future test suite use. The one real API call this phase makes is a manual, one-time, human-supervised live verification (Task 3), not part of `npm run test`.
- `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` are read from `process.env` only inside `server-only`-guarded files (matching `src/lib/supabase/service-role.ts`'s existing pattern) — never exposed to a client component, never logged, never included in any response body or error message.
- The AI's structured output is validated with Zod before being trusted or persisted — an invalid/malformed model response must produce a clear `PROVIDER_ERROR`-style failure, never a silently-accepted garbage result written to `analysis_runs`.
- `analysis_runs` writes go through the user-scoped Supabase client (RLS `auth.uid() = user_id`), matching every other write in this feature — never the service-role client.
- Reuse `InvestmentEvidence`/`DataCoverage` (Phase P4) and `QuantScoreBreakdown` (Phase P5) types directly — do not redeclare.
- Instrument resolution follows the established manual-first/Yahoo-fallback pattern from Phases P2/P3 exactly.
- After every code step: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit` must pass with zero errors.
- Work happens in the existing worktree/branch (`feature/investment-intelligence-p1`), continuing directly on top of P5's commits. Do not create a new worktree or branch.

---

### Task 1: AI provider module (schema, prompt, mock provider, Cloudflare provider)

**Files:**
- Create: `src/lib/ai/investment-analysis/response.ts`
- Create: `src/lib/ai/investment-analysis/prompt.ts`
- Create: `src/lib/ai/investment-analysis/provider.ts`
- Create: `src/lib/ai/investment-analysis/cloudflare-provider.ts`
- Create: `src/lib/ai/investment-analysis/get-provider.ts`
- Test: `tests/unit/investment-analysis-response.test.ts`
- Test: `tests/unit/investment-analysis-prompt.test.ts`

**Interfaces:**
- Consumes: `InvestmentEvidence` from `src/lib/evidence/builder.ts`; `QuantScoreBreakdown` from `src/lib/scoring/quant-score.ts`.
- Produces: `InvestmentAnalysisResult`, `InvestmentAnalysisResultSchema`, `parseAnalysisResponse`, `buildSystemPrompt`, `buildUserPrompt`, `InvestmentAnalysisProvider` interface, `MockInvestmentAnalysisProvider`, `CloudflareWorkersAIProvider`, `getInvestmentAnalysisProvider()` — consumed by Task 2's API route.

- [ ] **Step 1: Write the failing response-parsing tests**

```ts
// tests/unit/investment-analysis-response.test.ts
import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "@/lib/ai/investment-analysis/response";

function validPayload() {
  return {
    executiveSummary: "Sony shows steady profitability with moderate valuation risk.",
    mediumTerm: { score: 72, rating: "Attractive", thesis: "Margin expansion continues near-term." },
    longTerm: { score: 80, rating: "Strong", thesis: "Diversified segments support durable growth." },
    bullCase: { thesis: "Sensor demand accelerates.", triggers: ["New flagship smartphone cycle"] },
    baseCase: { thesis: "Steady mid-single-digit growth.", triggers: ["In-line quarterly results"] },
    bearCase: { thesis: "Yen appreciation compresses margins.", triggers: ["Sharp JPY strengthening"] },
    strengths: ["Diversified revenue base", "Strong balance sheet"],
    weaknesses: ["FX sensitivity"],
    managementAssessment: "Guidance has been consistently met over the last 4 quarters.",
    financialAssessment: "Operating margin trending upward.",
    valuationAssessment: "PER in line with historical average.",
    competitiveAssessment: "Leading position in image sensors.",
    dataGaps: ["No recent analyst opinions imported"],
    confidence: 68,
  };
}

describe("parseAnalysisResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = parseAnalysisResponse(JSON.stringify(validPayload()));
    expect(result.executiveSummary).toContain("Sony");
    expect(result.mediumTerm.score).toBe(72);
    expect(result.longTerm.rating).toBe("Strong");
  });

  it("strips a markdown code fence around the JSON before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(validPayload()) + "\n```";
    const result = parseAnalysisResponse(fenced);
    expect(result.confidence).toBe(68);
  });

  it("strips leading/trailing prose the model added around the JSON", () => {
    const withProse = "Here is my analysis:\n\n" + JSON.stringify(validPayload()) + "\n\nLet me know if you need more.";
    const result = parseAnalysisResponse(withProse);
    expect(result.bullCase.triggers).toEqual(["New flagship smartphone cycle"]);
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => parseAnalysisResponse("I cannot analyze this company.")).toThrow(/JSON/);
  });

  it("throws a descriptive error when the JSON is well-formed but fails schema validation", () => {
    const invalid = { ...validPayload(), mediumTerm: { score: "not a number", rating: "Attractive", thesis: "x" } };
    expect(() => parseAnalysisResponse(JSON.stringify(invalid))).toThrow();
  });

  it("rejects a confidence score outside 0-100", () => {
    const invalid = { ...validPayload(), confidence: 150 };
    expect(() => parseAnalysisResponse(JSON.stringify(invalid))).toThrow();
  });
});
```

- [ ] **Step 2: Write the failing prompt tests**

```ts
// tests/unit/investment-analysis-prompt.test.ts
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
```

- [ ] **Step 3: Run both new test files to verify they fail**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/investment-analysis-response.test.ts tests/unit/investment-analysis-prompt.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write `response.ts`**

```ts
// src/lib/ai/investment-analysis/response.ts
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
```

- [ ] **Step 5: Write `prompt.ts`**

```ts
// src/lib/ai/investment-analysis/prompt.ts
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
```

- [ ] **Step 6: Run both test files to verify they pass**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/investment-analysis-response.test.ts tests/unit/investment-analysis-prompt.test.ts`
Expected: PASS, 6/6 and 2/2 (8 total).

- [ ] **Step 7: Write the provider interface + mock provider**

```ts
// src/lib/ai/investment-analysis/provider.ts
import type { InvestmentEvidence } from "@/lib/evidence/builder";
import type { QuantScoreBreakdown } from "@/lib/scoring/quant-score";
import type { InvestmentAnalysisResult } from "./response";

export interface InvestmentAnalysisProvider {
  analyzeInvestment(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): Promise<InvestmentAnalysisResult>;
  readonly modelName: string;
}

/** テスト・ANALYSIS_PROVIDER=mock時に使う決定的なダミープロバイダー。実APIは一切呼ばない。 */
export class MockInvestmentAnalysisProvider implements InvestmentAnalysisProvider {
  readonly modelName = "mock";

  async analyzeInvestment(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): Promise<InvestmentAnalysisResult> {
    return {
      executiveSummary: `[MOCK] Analysis for ${evidence.company.name} based on ${evidence.financials.length} financial metrics.`,
      mediumTerm: { score: 50, rating: "Neutral", thesis: "[MOCK] Placeholder medium-term thesis." },
      longTerm: { score: 50, rating: "Neutral", thesis: "[MOCK] Placeholder long-term thesis." },
      bullCase: { thesis: "[MOCK] Bull case placeholder.", triggers: [] },
      baseCase: { thesis: "[MOCK] Base case placeholder.", triggers: [] },
      bearCase: { thesis: "[MOCK] Bear case placeholder.", triggers: [] },
      strengths: [],
      weaknesses: [],
      managementAssessment: "[MOCK]",
      financialAssessment: `[MOCK] Quant total: ${quantScore.total ?? "n/a"}`,
      valuationAssessment: "[MOCK]",
      competitiveAssessment: "[MOCK]",
      dataGaps: ["This is a mock result; no real AI analysis was performed."],
      confidence: 0,
    };
  }
}
```

- [ ] **Step 8: Write the Cloudflare provider**

```ts
// src/lib/ai/investment-analysis/cloudflare-provider.ts
import "server-only";
import type { InvestmentEvidence } from "@/lib/evidence/builder";
import type { QuantScoreBreakdown } from "@/lib/scoring/quant-score";
import type { InvestmentAnalysisProvider } from "./provider";
import type { InvestmentAnalysisResult } from "./response";
import { parseAnalysisResponse } from "./response";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";

interface CloudflareAiRunResponse {
  result?: { response?: string };
  success: boolean;
  errors?: Array<{ message: string }>;
}

export class CloudflareWorkersAIProvider implements InvestmentAnalysisProvider {
  readonly modelName: string;
  private readonly accountId: string;
  private readonly apiToken: string;

  constructor(accountId: string, apiToken: string, model: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.modelName = model;
  }

  async analyzeInvestment(evidence: InvestmentEvidence, quantScore: QuantScoreBreakdown): Promise<InvestmentAnalysisResult> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(evidence, quantScore) },
        ],
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`Cloudflare Workers AI request failed: ${res.status} ${bodyText.slice(0, 300)}`);
    }

    const body = (await res.json()) as CloudflareAiRunResponse;
    if (!body.success || !body.result?.response) {
      const message = body.errors?.map((e) => e.message).join("; ") ?? "no response text";
      throw new Error(`Cloudflare Workers AI returned no usable response: ${message}`);
    }

    return parseAnalysisResponse(body.result.response);
  }
}
```

- [ ] **Step 9: Write the provider factory**

```ts
// src/lib/ai/investment-analysis/get-provider.ts
import "server-only";
import type { InvestmentAnalysisProvider } from "./provider";
import { MockInvestmentAnalysisProvider } from "./provider";
import { CloudflareWorkersAIProvider } from "./cloudflare-provider";

let cached: InvestmentAnalysisProvider | null = null;

export function getInvestmentAnalysisProvider(): InvestmentAnalysisProvider {
  if (cached) return cached;

  if (process.env.ANALYSIS_PROVIDER === "mock") {
    cached = new MockInvestmentAnalysisProvider();
    return cached;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  if (!accountId || !apiToken) {
    // 認証情報が無い環境（CI等）ではmockへフォールバックし、実APIキー漏洩や起動失敗を避ける。
    cached = new MockInvestmentAnalysisProvider();
    return cached;
  }

  cached = new CloudflareWorkersAIProvider(accountId, apiToken, model);
  return cached;
}
```

- [ ] **Step 10: Type-check and full suite**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, all tests passing (155 existing + 8 new = 163).

- [ ] **Step 11: Commit**

```bash
git add src/lib/ai/investment-analysis/ tests/unit/investment-analysis-response.test.ts tests/unit/investment-analysis-prompt.test.ts
git commit -m "feat: add Cloudflare Workers AI investment analysis provider"
```

---

### Task 2: Evidence hash helper + analysis orchestration route + env docs

**Files:**
- Create: `src/lib/evidence/hash.ts`
- Test: `tests/unit/evidence-hash.test.ts`
- Create: `src/app/api/analysis/run/route.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `listFinancialMetrics`, `listManagementStatements`, `listCompanyCatalysts`, `listCompanyRisks`, `listCompanyEvents`, `listResearchOpinions`, `listResearchReports` (all from `src/server/repositories/evidence-repository.ts`); `buildInvestmentEvidence` (P4); `computeQuantScore` (P5); `getInvestmentAnalysisProvider` (Task 1); `resolveOrCreateInstrument`, `findInstrumentByProviderSymbol` (established pattern).
- Produces: `computeEvidenceHash(evidence): string` — used by the route to populate `analysis_runs.evidence_hash`.

- [ ] **Step 1: Write the failing hash test**

```ts
// tests/unit/evidence-hash.test.ts
import { describe, expect, it } from "vitest";
import { computeEvidenceHash } from "@/lib/evidence/hash";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";
import type { FinancialMetric } from "@/types/evidence";

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

function metric(id: string): FinancialMetric {
  return {
    id,
    instrumentId: "inst-1",
    metricKey: "roe",
    value: 15,
    unit: null,
    currency: null,
    periodType: "FY",
    periodStart: "2025-04-01",
    periodEnd: "2026-03-31",
    reportedAt: null,
    sourceId: null,
    sourceReportId: null,
    isManual: true,
    createdAt: "2026-08-20T00:00:00Z",
  };
}

function baseInput(financials: FinancialMetric[] = []) {
  return {
    company,
    market,
    financials,
    managementStatements: [],
    catalysts: [],
    risks: [],
    events: [],
    opinions: [],
    research: [],
  };
}

describe("computeEvidenceHash", () => {
  it("produces the same hash for the same set of evidence IDs regardless of array order", () => {
    const a = buildInvestmentEvidence(baseInput([metric("m1"), metric("m2")]));
    const b = buildInvestmentEvidence(baseInput([metric("m2"), metric("m1")]));
    expect(computeEvidenceHash(a)).toBe(computeEvidenceHash(b));
  });

  it("produces a different hash when the evidence set changes", () => {
    const a = buildInvestmentEvidence(baseInput([metric("m1")]));
    const b = buildInvestmentEvidence(baseInput([metric("m1"), metric("m2")]));
    expect(computeEvidenceHash(a)).not.toBe(computeEvidenceHash(b));
  });

  it("returns a 64-character hex sha256 digest", () => {
    const evidence = buildInvestmentEvidence(baseInput());
    expect(computeEvidenceHash(evidence)).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/evidence-hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/evidence/hash.ts
import { createHash } from "crypto";
import type { InvestmentEvidence } from "./builder";

/**
 * その分析がどのevidence行に基づいていたかを表す安定なハッシュ。
 * 値そのものではなく行IDの集合だけを見る（各配列をソートして順序非依存にする）ため、
 * 同じ行の集合なら常に同じハッシュになる。将来evidenceが変更/追加されたら別ハッシュになり、
 * 「前回分析時と同じ根拠か」をanalysis_runs.evidence_hashで比較できるようにする。
 */
export function computeEvidenceHash(evidence: InvestmentEvidence): string {
  const idSets = {
    financials: evidence.financials.map((m) => m.id).sort(),
    managementStatements: evidence.managementStatements.map((m) => m.id).sort(),
    catalysts: evidence.catalysts.map((c) => c.id).sort(),
    risks: evidence.risks.map((r) => r.id).sort(),
    events: evidence.events.map((e) => e.id).sort(),
    opinions: evidence.opinions.map((o) => o.id).sort(),
    research: evidence.research.map((r) => r.id).sort(),
  };
  return createHash("sha256").update(JSON.stringify(idSets)).digest("hex");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/evidence-hash.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Write the orchestration route**

```ts
// src/app/api/analysis/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { resolveOrCreateInstrument } from "@/server/services/resolve-instrument";
import { findInstrumentByProviderSymbol } from "@/server/repositories/instruments-repository";
import { getMarketDataProvider } from "@/lib/market-data/get-provider";
import { normalizeProviderSymbol } from "@/lib/market-data/normalize";
import {
  listFinancialMetrics,
  listManagementStatements,
  listCompanyCatalysts,
  listCompanyRisks,
  listCompanyEvents,
  listResearchOpinions,
  listResearchReports,
} from "@/server/repositories/evidence-repository";
import { buildInvestmentEvidence } from "@/lib/evidence/builder";
import type { CompanySnapshot, MarketSnapshot } from "@/lib/evidence/builder";
import { computeEvidenceHash } from "@/lib/evidence/hash";
import { computeQuantScore } from "@/lib/scoring/quant-score";
import { getInvestmentAnalysisProvider } from "@/lib/ai/investment-analysis/get-provider";

const requestSchema = z.object({
  providerSymbol: z.string().trim().min(1),
});

const ANALYSIS_VERSION = "p6-v1";
const SCORING_VERSION = "quant-v1";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", parsed.error.issues[0]?.message);

  // 手入力ファンド（provider='manual'）は大文字小文字を区別する生のprovider_symbolで登録されており、
  // resolveOrCreateInstrumentはprovider='yahoo'固定・シンボルを大文字化してしまうため一致しない
  // （src/app/api/research/import/route.ts、src/app/api/research/metrics/route.ts の同種コメント参照）。
  const manualInstrument = await findInstrumentByProviderSymbol(supabase, parsed.data.providerSymbol, "manual").catch(
    () => null
  );

  let companySnapshot: CompanySnapshot;
  let marketSnapshot: MarketSnapshot;
  let instrumentId: string;

  if (manualInstrument) {
    instrumentId = manualInstrument.id;
    companySnapshot = {
      instrumentId: manualInstrument.id,
      providerSymbol: manualInstrument.provider_symbol,
      name: manualInstrument.name,
      exchange: manualInstrument.exchange,
      market: manualInstrument.market,
      currency: manualInstrument.currency,
      sector: manualInstrument.sector,
      industry: manualInstrument.industry,
    };
    // 手入力ファンドはYahoo等のリアルタイム相場を持たない（基準価額は別途手入力管理）。
    marketSnapshot = {
      priceDate: null,
      close: null,
      previousClose: null,
      change: null,
      changePercent: null,
      dividendYield: null,
      trailingPE: null,
      marketCap: null,
    };
  } else {
    const providerSymbol = normalizeProviderSymbol(parsed.data.providerSymbol);
    const provider = getMarketDataProvider();
    const info = await provider.getInstrumentInfo(providerSymbol).catch(() => null);
    if (!info) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");

    const instrument = await resolveOrCreateInstrument(providerSymbol).catch(() => null);
    if (!instrument) return apiError("NOT_FOUND", "指定された銘柄が見つかりませんでした。");
    instrumentId = instrument.id;

    const quote = await provider.getQuote(providerSymbol).catch(() => null);

    companySnapshot = {
      instrumentId: instrument.id,
      providerSymbol: info.providerSymbol,
      name: info.name,
      exchange: info.exchange,
      market: info.market,
      currency: info.currency,
      sector: instrument.sector,
      industry: instrument.industry,
    };
    marketSnapshot = {
      priceDate: quote?.priceDate ?? null,
      close: quote?.close ?? null,
      previousClose: quote?.previousClose ?? null,
      change: quote?.change ?? null,
      changePercent: quote?.changePercent ?? null,
      dividendYield: quote?.dividendYield ?? null,
      trailingPE: quote?.trailingPE ?? null,
      marketCap: quote?.marketCap ?? null,
    };
  }

  try {
    const [financials, managementStatements, catalysts, risks, events, opinions, research] = await Promise.all([
      listFinancialMetrics(supabase, instrumentId),
      listManagementStatements(supabase, instrumentId),
      listCompanyCatalysts(supabase, instrumentId),
      listCompanyRisks(supabase, instrumentId),
      listCompanyEvents(supabase, instrumentId),
      listResearchOpinions(supabase, instrumentId),
      listResearchReports(supabase, instrumentId),
    ]);

    const evidence = buildInvestmentEvidence({
      company: companySnapshot,
      market: marketSnapshot,
      financials: financials.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        metricKey: row.metric_key,
        value: row.value,
        unit: row.unit,
        currency: row.currency,
        periodType: row.period_type,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        reportedAt: row.reported_at,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        isManual: row.is_manual,
        createdAt: row.created_at,
      })),
      managementStatements: managementStatements.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        personName: row.person_name,
        role: row.role,
        statement: row.statement,
        statementDate: row.statement_date,
        topic: row.topic,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        page: row.page,
        confidence: row.confidence,
        createdAt: row.created_at,
      })),
      catalysts: catalysts.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        catalystType: row.catalyst_type,
        description: row.description,
        expectedTiming: row.expected_timing,
        impact: row.impact,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        createdAt: row.created_at,
      })),
      risks: risks.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        riskType: row.risk_type,
        description: row.description,
        severity: row.severity,
        likelihood: row.likelihood,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        detectedAt: row.detected_at,
        createdAt: row.created_at,
      })),
      events: events.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        eventType: row.event_type,
        title: row.title,
        description: row.description,
        eventDate: row.event_date,
        sourceId: row.source_id,
        sourceReportId: row.source_report_id,
        createdAt: row.created_at,
      })),
      opinions: opinions.map((row) => ({
        id: row.id,
        instrumentId: row.instrument_id,
        author: row.author,
        organization: row.organization,
        stance: row.stance,
        summary: row.summary,
        rating: row.rating,
        targetPrice: row.target_price,
        publishedAt: row.published_at,
        sourceId: row.source_id,
        sourceUrl: row.source_url,
        reliability: row.reliability,
        createdAt: row.created_at,
      })),
      research,
    });

    const quantScore = computeQuantScore(evidence.financials);
    const evidenceHash = computeEvidenceHash(evidence);

    const provider = getInvestmentAnalysisProvider();
    const analysis = await provider.analyzeInvestment(evidence, quantScore);

    const { data: run, error: insertError } = await supabase
      .from("analysis_runs")
      .insert({
        user_id: user.id,
        instrument_id: instrumentId,
        model: provider.modelName,
        analysis_version: ANALYSIS_VERSION,
        scoring_version: SCORING_VERSION,
        input_snapshot: evidence,
        evidence_hash: evidenceHash,
        quant_score: quantScore.total,
        medium_score: analysis.mediumTerm.score,
        long_score: analysis.longTerm.score,
        confidence: analysis.confidence,
        result_json: analysis,
        status: "success",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ data: { analysisRunId: run.id, quantScore, analysis } });
  } catch (err) {
    console.error("POST /api/analysis/run failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
```

- [ ] **Step 6: Update `.env.example`**

Append to `.env.example` (after the existing `ENABLE_JPY_CONVERSION=true` line):

```bash

ANALYSIS_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
```

- [ ] **Step 7: Type-check and full suite**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, all tests passing (163 existing + 3 new = 166). If any `Database["public"]["Tables"]["financial_metrics"]["Row"]["metric_key"]` vs the domain `MetricKey` type mismatch appears when mapping raw rows into `FinancialMetric` objects, resolve it by checking the exact literal union in `src/types/supabase.ts` (Phase P1's fix made this a proper 21-value union, not a bare `string`) — it should assign without a cast; if `tsc` disagrees, investigate why rather than reaching for `as any`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/evidence/hash.ts tests/unit/evidence-hash.test.ts "src/app/api/analysis/run/route.ts" .env.example
git commit -m "feat: add analysis orchestration route combining evidence, quant score, and AI analysis"
```

---

### Task 3: Live verification (controller-performed, not a subagent)

This task is performed directly by the controller (not dispatched to a subagent), because it involves one real, paid call to the Cloudflare Workers AI API using the user's actual credentials — a sensitive, cost-incurring action that should be made deliberately and observed directly, not delegated.

- [ ] **Step 1**: Confirm `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are present in `.env.local` (already confirmed present earlier in this project).
- [ ] **Step 2**: With the dev server running (or a standalone Node script using the same `.env.local`-reading pattern as every prior phase's live verification), make exactly ONE real call to `/api/analysis/run` for one real instrument that has at least a little evidence (reuse whatever minimal financial metric / research data is convenient — insert one or two rows first if the target instrument currently has none, so the AI has *something* concrete to reason about rather than an entirely empty packet).
- [ ] **Step 3**: Inspect the actual HTTP response and the `console.error` output (if any) to confirm: the Cloudflare API accepted the request, `CLOUDFLARE_AI_MODEL`'s default model name is valid (if Cloudflare rejects the model name, note the actual error and pick a different current valid model — do not guess blindly, read Cloudflare's error message), the model's response was successfully parsed as JSON and passed Zod validation, and an `analysis_runs` row was actually written with `status = 'success'`.
- [ ] **Step 4**: Query the `analysis_runs` table directly (service-role client, same pattern as every prior live-verification script) to confirm the row's `result_json`, `quant_score`, `medium_score`, `long_score`, `confidence`, `evidence_hash`, and `model` fields are populated sensibly.
- [ ] **Step 5**: Report the actual AI-generated content briefly (e.g. the `executiveSummary` and `mediumTerm.rating`) so there's human-visible evidence the real integration produced a real, evidence-grounded answer — not just "no error was thrown."
- [ ] **Step 6**: Clean up: delete the test `analysis_runs` row (and any evidence rows inserted solely to give the AI something to analyze) from the live database, same as every prior phase's cleanup step.

If Step 2/3 reveals the default model name is invalid or deprecated, fix `CLOUDFLARE_AI_MODEL`'s default in `get-provider.ts` to a model confirmed to work, re-run steps 2-6, and commit that fix separately (`fix: correct default Cloudflare Workers AI model name`).

---

## Definition of Done for Phase P6

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` passes with zero failures (166 tests — all using the mock provider or pure functions, no test hits the real Cloudflare API).
- [ ] One real, human-supervised Cloudflare Workers AI call was made and verified end-to-end against the live Supabase project, with results reported and test data cleaned up.
- [ ] `.env.example` documents the four new Cloudflare/analysis-provider variables.
- [ ] No existing file outside `.env.example` was modified.

## What's Deliberately Not in This Phase

No AI Analysis UI (Phase P7 — no "AI分析を更新" button, no score display page). No evidence-hash-based caching/skip-if-unchanged logic (a reasonable P7+ enhancement — `evidence_hash` is stored now so it's available when that's built). No qualitative sub-score breakdown persisted separately from `result_json` (the `analysis_runs.qual_score` column is left `null` in this phase — deferred until a dedicated qualitative rubric is designed, matching the plan's YAGNI principle since there is no consumer for it yet). No automatic re-analysis triggers, no cron, no rate limiting beyond what Cloudflare itself enforces.
