# Investment Intelligence P7: AI Research Structuring ("Worker A") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pasted ("貼り付け") research report be turned into fully structured evidence (financial_metrics, management_statements, catalysts, risks, events) by AI, instead of only being usable as a raw-text excerpt in the analysis prompt.

**Architecture:** This is a scoped-down implementation of the user's "Cloudflare Workers 2-stage architecture" request ("Worker A" = research structuring, "Worker B" = long-term analysis). Worker B already exists as `/api/analysis/run` (built in P6) and is reused unchanged. Worker A is new: a Cloudflare Workers AI call that reads a `paste_text` report's `raw_content` plus the target company's identity, and outputs JSON matching the existing `ResearchImportSchema` (the same schema `insertJsonImport` already knows how to cascade into the 6 evidence tables). The route validates that JSON with Zod (extraction only — the AI never gets to skip validation) and then re-uses `insertJsonImport` unchanged. No new tables. No R2. No Vectorize. No PDF/URL fetching (text-only, since the source is always an existing `raw_content` field already in our DB, not a user-supplied URL) — this keeps the SSRF/large-file-security surface from the original spec out of scope, because there is nothing to fetch.

**Tech Stack:** Next.js 14 App Router (route handlers), Supabase, Zod, Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` by default, same model already in production use), Vitest.

## Global Constraints

- Extraction only, never fabrication: the structuring prompt must instruct the model to omit any field it cannot support from the text, never to invent or zero-fill a number. This mirrors the exact rules already given to *external* AI in `docs/research/stockscope_ai_research_prompt.md` — this plan's prompt is the same rules, addressed to Cloudflare's model instead of a human copying into ChatGPT.
- The AI's structured output must be validated with `ResearchImportSchema` (from `src/lib/evidence/schemas.ts`) before anything touches the database — an invalid or malformed AI response must produce a client-visible `INVALID_REQUEST`-shaped error via `apiError`, never a silent partial write.
- Only `paste_text`-mode reports can be structured (a `json`-mode report is already structured; a `manual_form`-mode report doesn't exist yet in this codebase). Attempting to structure a non-`paste_text` report must return a 400 with a clear message, mirroring the existing `UNSUPPORTED_MODE` pattern in `updateResearchReport`.
- Model selection must go through a new task-based config (`getAiModelConfig("structure_research" | "analyze_investment")`), not a second hardcoded model string — this is the "AiTask/AiModelConfig abstraction" the user's original spec asked for, scoped down to exactly the two tasks that exist today.
- Reuse `insertJsonImport` for the actual cascade-insert. Do not write a second insert path.
- No test coverage is required for repository/route/provider files that only orchestrate I/O (matches the established convention already in this codebase — see `.superpowers/sdd/progress.md`, "Deferred minor (P2)"). Pure functions (prompt builders, response parsers, the model-config lookup) DO get unit tests, per the codebase's existing TDD pattern for `src/lib/ai/investment-analysis/{prompt,response}.ts`.
- `export const maxDuration = 60;` is required on the new route, exactly like `src/app/api/analysis/run/route.ts`, because the Cloudflare call can take tens of seconds and Vercel's default function timeout is shorter (this was a real Critical bug caught only by live verification in P6 — do not reintroduce it).

---

### Task 1: Extract shared AI-JSON-response parsing helper

**Files:**
- Create: `src/lib/ai/extract-json.ts`
- Modify: `src/lib/ai/investment-analysis/response.ts`
- Test: `tests/unit/extract-json.test.ts`

**Interfaces:**
- Produces: `extractJsonFromAiResponse(raw: unknown): unknown` — given either a JSON string (optionally wrapped in prose or a markdown code fence) or an already-parsed object, returns the parsed JSON value, or throws a descriptive `Error` if `raw` is a string with no JSON object in it, or is neither a string nor an object.
- Consumes (Task 4): Task 4's `parseStructuringResponse` will call this same function.

This task is a pure refactor: `src/lib/ai/investment-analysis/response.ts`'s `parseAnalysisResponse` currently has this exact JSON-extraction logic inlined. Task 4 needs the identical logic for research structuring. Extracting it now means both call sites share one tested implementation instead of two copies drifting apart.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/extract-json.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractJsonFromAiResponse } from "@/lib/ai/extract-json";

describe("extractJsonFromAiResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = extractJsonFromAiResponse('{"a": 1, "b": "two"}');
    expect(result).toEqual({ a: 1, b: "two" });
  });

  it("strips a markdown code fence around the JSON before parsing", () => {
    const fenced = '```json\n{"a": 1}\n```';
    expect(extractJsonFromAiResponse(fenced)).toEqual({ a: 1 });
  });

  it("strips leading/trailing prose the model added around the JSON", () => {
    const withProse = 'Here is the result:\n\n{"a": 1}\n\nLet me know if you need more.';
    expect(extractJsonFromAiResponse(withProse)).toEqual({ a: 1 });
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => extractJsonFromAiResponse("I cannot do that.")).toThrow(/JSON/);
  });

  it("throws a descriptive error when the JSON text is malformed", () => {
    expect(() => extractJsonFromAiResponse("{not valid json,,,}")).toThrow(/could not be parsed/);
  });

  it("passes an already-parsed object through unchanged", () => {
    const obj = { a: 1, nested: { b: 2 } };
    expect(extractJsonFromAiResponse(obj)).toBe(obj);
  });

  it("throws a descriptive error when given neither a string nor an object", () => {
    expect(() => extractJsonFromAiResponse(null)).toThrow(/neither/);
    expect(() => extractJsonFromAiResponse(42)).toThrow(/neither/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/extract-json.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/extract-json'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/extract-json.ts`:

```typescript
/**
 * モデルの生出力からJSON本体を取り出す。LLMはJSON前後に説明文やmarkdownの
 * コードフェンス（```json ... ```）を付けることがあるため、文字列の場合は
 * 最初の '{' から最後の '}' までを抽出してからパースする。Cloudflare Workers AI
 * の一部モデルは出力がJSON形状だと判定すると、文字列ではなくパース済みオブジェクト
 * をそのまま返すため、オブジェクトが渡された場合はそのまま返す（再パースしない）。
 */
export function extractJsonFromAiResponse(raw: unknown): unknown {
  if (typeof raw === "string") {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error(`AI response contained no JSON object: ${raw.slice(0, 200)}`);
    }
    const jsonText = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonText);
    } catch (err) {
      throw new Error(`AI response JSON could not be parsed: ${(err as Error).message}`);
    }
  }
  if (raw !== null && typeof raw === "object") {
    return raw;
  }
  throw new Error(`AI response was neither a JSON string nor an object (got ${typeof raw})`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/extract-json.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Refactor `parseAnalysisResponse` to use the shared helper**

In `src/lib/ai/investment-analysis/response.ts`, replace the inlined extraction logic (everything between `let parsedJson: unknown;` and the `InvestmentAnalysisResultSchema.safeParse(parsedJson);` line) so the function becomes:

```typescript
import { extractJsonFromAiResponse } from "@/lib/ai/extract-json";

// ... (keep InvestmentAnalysisResultSchema and InvestmentAnalysisResult exactly as-is) ...

/**
 * モデルの生出力をZod検証する。JSON抽出自体は共通ヘルパー（extractJsonFromAiResponse）に委譲する。
 */
export function parseAnalysisResponse(raw: unknown): InvestmentAnalysisResult {
  const parsedJson = extractJsonFromAiResponse(raw);
  const result = InvestmentAnalysisResultSchema.safeParse(parsedJson);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(`AI response failed schema validation at "${firstIssue?.path.join(".")}": ${firstIssue?.message}`);
  }
  return result.data;
}
```

Delete the old inlined `if (typeof raw === "string") { ... } else if (...) { ... } else { ... }` block entirely — it now lives only in `extract-json.ts`.

- [ ] **Step 6: Run the full existing response test suite to verify no regression**

Run: `npx vitest run tests/unit/investment-analysis-response.test.ts`
Expected: PASS (all 9 existing tests, unchanged) — this file's tests exercise `parseAnalysisResponse` end-to-end, so a passing run here proves the refactor preserved behavior exactly.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/extract-json.ts src/lib/ai/investment-analysis/response.ts tests/unit/extract-json.test.ts
git commit -m "refactor: extract shared AI-JSON-response parsing into extract-json.ts"
```

---

### Task 2: AiTask / AiModelConfig abstraction

**Files:**
- Create: `src/lib/ai/model-config.ts`
- Modify: `src/lib/ai/investment-analysis/get-provider.ts`
- Test: `tests/unit/ai-model-config.test.ts`

**Interfaces:**
- Produces: `type AiTask = "analyze_investment" | "structure_research"`, `interface AiModelConfig { model: string; maxTokens: number; timeoutMs: number }`, `getAiModelConfig(task: AiTask): AiModelConfig`.
- Consumes (Task 4): Task 4's Cloudflare structuring provider calls `getAiModelConfig("structure_research")`.

Today `CLOUDFLARE_AI_MODEL` is a single hardcoded env var read directly inside `get-provider.ts`. The user's original spec asked for model configuration to be per-task (`AI_MODEL_STRUCTURE`, `AI_MODEL_ANALYZE`, etc.) rather than one flat model name, so that structuring (cheaper/faster, higher volume) and analysis (more expensive, lower volume) can be tuned independently later. This task introduces that lookup and wires the *existing* analysis provider through it, without changing its default behavior (same model, same 4000 max_tokens, same 60s timeout unless overridden).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ai-model-config.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiModelConfig } from "@/lib/ai/model-config";

describe("getAiModelConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the default model/maxTokens/timeout for analyze_investment when no env override is set", () => {
    vi.stubEnv("AI_MODEL_ANALYZE", "");
    vi.stubEnv("CLOUDFLARE_AI_MODEL", "");
    const config = getAiModelConfig("analyze_investment");
    expect(config.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(config.maxTokens).toBe(4000);
    expect(config.timeoutMs).toBe(60_000);
  });

  it("returns a distinct default model/maxTokens/timeout for structure_research", () => {
    vi.stubEnv("AI_MODEL_STRUCTURE", "");
    const config = getAiModelConfig("structure_research");
    expect(config.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(config.maxTokens).toBe(4000);
    expect(config.timeoutMs).toBe(60_000);
  });

  it("prefers AI_MODEL_ANALYZE over the legacy CLOUDFLARE_AI_MODEL for analyze_investment", () => {
    vi.stubEnv("AI_MODEL_ANALYZE", "@cf/some/new-model");
    vi.stubEnv("CLOUDFLARE_AI_MODEL", "@cf/old/legacy-model");
    expect(getAiModelConfig("analyze_investment").model).toBe("@cf/some/new-model");
  });

  it("falls back to the legacy CLOUDFLARE_AI_MODEL for analyze_investment when AI_MODEL_ANALYZE is unset (backward compat)", () => {
    vi.stubEnv("AI_MODEL_ANALYZE", "");
    vi.stubEnv("CLOUDFLARE_AI_MODEL", "@cf/old/legacy-model");
    expect(getAiModelConfig("analyze_investment").model).toBe("@cf/old/legacy-model");
  });

  it("uses AI_MODEL_STRUCTURE as an override for structure_research", () => {
    vi.stubEnv("AI_MODEL_STRUCTURE", "@cf/some/structuring-model");
    expect(getAiModelConfig("structure_research").model).toBe("@cf/some/structuring-model");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ai-model-config.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/model-config'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/model-config.ts`:

```typescript
export type AiTask = "analyze_investment" | "structure_research";

export interface AiModelConfig {
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// タスクごとに独立したモデル・トークン上限・タイムアウトを持たせる。将来「構造化は安価な
// モデル、分析は高精度モデル」のように使い分ける際、この関数だけを変更すればよい。
// analyze_investmentのみ、P6で先に導入されたCLOUDFLARE_AI_MODELへの後方互換フォールバックを持つ。
const TASK_ENV_VAR: Record<AiTask, string> = {
  analyze_investment: "AI_MODEL_ANALYZE",
  structure_research: "AI_MODEL_STRUCTURE",
};

const TASK_DEFAULTS: Record<AiTask, Omit<AiModelConfig, "model">> = {
  analyze_investment: { maxTokens: 4000, timeoutMs: 60_000 },
  structure_research: { maxTokens: 4000, timeoutMs: 60_000 },
};

export function getAiModelConfig(task: AiTask): AiModelConfig {
  const envValue = process.env[TASK_ENV_VAR[task]];
  const legacyFallback = task === "analyze_investment" ? process.env.CLOUDFLARE_AI_MODEL : undefined;
  const model = envValue || legacyFallback || DEFAULT_MODEL;
  return { model, ...TASK_DEFAULTS[task] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ai-model-config.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire `get-provider.ts` (investment-analysis) through the new config**

In `src/lib/ai/investment-analysis/get-provider.ts`, replace the direct `process.env.CLOUDFLARE_AI_MODEL` read:

```typescript
import "server-only";
import type { InvestmentAnalysisProvider } from "./provider";
import { MockInvestmentAnalysisProvider } from "./provider";
import { CloudflareWorkersAIProvider } from "./cloudflare-provider";
import { getAiModelConfig } from "@/lib/ai/model-config";

let cached: InvestmentAnalysisProvider | null = null;

export function getInvestmentAnalysisProvider(): InvestmentAnalysisProvider {
  if (cached) return cached;

  if (process.env.ANALYSIS_PROVIDER === "mock") {
    cached = new MockInvestmentAnalysisProvider();
    return cached;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    // 認証情報欠如時にmockへ黙ってフォールバックすると、本番で環境変数の設定漏れ/typoが
    // あった場合に「成功」として記録された分析結果（実際はプレースホルダー）がanalysis_runsに
    // 残ってしまう（fail-open）。mockを使いたい場合はANALYSIS_PROVIDER=mockを明示させる
    // （fail-closed）。自動テストはgetInvestmentAnalysisProvider/CloudflareWorkersAIProviderを
    // 呼ばないため、この分岐はCIの動作には影響しない。
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set to use the Cloudflare analysis provider. " +
        "Set ANALYSIS_PROVIDER=mock explicitly if a mock result is intended."
    );
  }

  const { model } = getAiModelConfig("analyze_investment");
  cached = new CloudflareWorkersAIProvider(accountId, apiToken, model);
  return cached;
}
```

(Only the model-lookup line changed — everything else in this file is unchanged.)

- [ ] **Step 6: Run the full test suite to verify no regression**

Run: `npx vitest run`
Expected: PASS (all tests, count = previous total + 12 new from Tasks 1-2)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/model-config.ts src/lib/ai/investment-analysis/get-provider.ts tests/unit/ai-model-config.test.ts
git commit -m "feat: add task-based AI model configuration (AiTask/AiModelConfig)"
```

---

### Task 3: Research structuring prompt builder and provider interface

**Files:**
- Create: `src/lib/ai/research-structuring/provider.ts`
- Create: `src/lib/ai/research-structuring/prompt.ts`
- Test: `tests/unit/research-structuring-prompt.test.ts`

**Interfaces:**
- Produces: `interface ResearchStructuringProvider { structureResearch(input: StructuringInput): Promise<ResearchImportInput>; readonly modelName: string }`, `interface StructuringInput { rawContent: string; company: { ticker: string; name: string; exchange: string }; researchDate: string }`, `class MockResearchStructuringProvider implements ResearchStructuringProvider`, `buildStructuringSystemPrompt(): string`, `buildStructuringUserPrompt(input: StructuringInput): string`.
- Consumes: `ResearchImportInput` type from `@/lib/evidence/schemas` (already exists, from P1/P2).

The system prompt must carry the same "never fabricate, omit unknowns, exact schema, exact metricKey list" rules already proven correct in `docs/research/stockscope_ai_research_prompt.md` (written for a human to paste into external AI) and in `insertJsonImport`'s cascade logic (which trusts the shape completely once Zod validates it) — this task writes the same rules as a system prompt for our own Cloudflare call.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/research-structuring-prompt.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildStructuringSystemPrompt, buildStructuringUserPrompt } from "@/lib/ai/research-structuring/prompt";

describe("buildStructuringSystemPrompt", () => {
  it("instructs the model to extract only, never fabricate, and to omit unknown fields", () => {
    const prompt = buildStructuringSystemPrompt();
    expect(prompt).toMatch(/do not fabricate|never fabricate/i);
    expect(prompt).toMatch(/omit/i);
    expect(prompt).toMatch(/metricKey/);
  });

  it("lists the exact allowed metricKey values so the model cannot invent new ones", () => {
    const prompt = buildStructuringSystemPrompt();
    expect(prompt).toContain("revenue");
    expect(prompt).toContain("operating_margin");
    expect(prompt).toContain("dividend_yield");
  });
});

describe("buildStructuringUserPrompt", () => {
  it("embeds the company identity, research date, and raw content", () => {
    const prompt = buildStructuringUserPrompt({
      rawContent: "NTTの2026年度1Q決算は営業収益+10.9%、営業利益+4.9%で増収増益だった。",
      company: { ticker: "9432.T", name: "NTT, Inc.", exchange: "Tokyo" },
      researchDate: "2026-08-22",
    });
    expect(prompt).toContain("9432.T");
    expect(prompt).toContain("NTT, Inc.");
    expect(prompt).toContain("2026-08-22");
    expect(prompt).toContain("NTTの2026年度1Q決算");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-structuring-prompt.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/research-structuring/prompt'`

- [ ] **Step 3: Write the provider interface**

Create `src/lib/ai/research-structuring/provider.ts`:

```typescript
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
```

- [ ] **Step 4: Write the prompt builder**

Create `src/lib/ai/research-structuring/prompt.ts`:

```typescript
import { metricKeyValues } from "@/lib/evidence/schemas";
import type { StructuringInput } from "./provider";

export function buildStructuringSystemPrompt(): string {
  return `You are a research-extraction assistant. You extract structured facts from a piece of text about a public company. You do not analyze, judge, recommend, or predict anything — extraction only.

Rules:
1. Never fabricate a number or fact. If a value is not clearly stated in the text, omit that entry entirely rather than guessing or using 0 as a placeholder.
2. Do not use general knowledge about the company beyond what is in the supplied text.
3. Every date must be a real calendar date in YYYY-MM-DD format. If only a partial date is known (e.g. "sometime in 2023"), omit that entry rather than guessing a day.
4. financials[].metricKey must be exactly one of these values (no others are accepted): ${metricKeyValues.join(", ")}. If a number in the text does not map to one of these (e.g. segment-level revenue, a scenario-based price target), leave it out of financials and mention it in "summary" instead.
5. periodType is "FY" (full fiscal year) or "Q" (quarter). periodStart/periodEnd are that period's start/end dates.
6. Give every source you use a short unique sourceKey, and reference it from each item you extract via that item's own sourceKey field, so the origin of every fact is traceable.
7. Respond with ONLY a single JSON object, no markdown code fences, no explanation before or after the JSON, matching exactly this shape:
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

# Text to extract from
${input.rawContent}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-structuring-prompt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/research-structuring/provider.ts src/lib/ai/research-structuring/prompt.ts tests/unit/research-structuring-prompt.test.ts
git commit -m "feat: add research structuring provider interface and prompt builder"
```

---

### Task 4: Cloudflare structuring provider + response parsing + get-provider

**Files:**
- Create: `src/lib/ai/research-structuring/response.ts`
- Create: `src/lib/ai/research-structuring/cloudflare-provider.ts`
- Create: `src/lib/ai/research-structuring/get-provider.ts`
- Test: `tests/unit/research-structuring-response.test.ts`

**Interfaces:**
- Consumes: `extractJsonFromAiResponse` (Task 1), `ResearchImportSchema`/`ResearchImportInput` (existing, `@/lib/evidence/schemas`), `getAiModelConfig` (Task 2), `StructuringInput`/`ResearchStructuringProvider`/`MockResearchStructuringProvider` (Task 3).
- Produces: `parseStructuringResponse(raw: unknown): ResearchImportInput`, `class CloudflareResearchStructuringProvider implements ResearchStructuringProvider`, `getResearchStructuringProvider(): ResearchStructuringProvider`.

This task closely mirrors `src/lib/ai/investment-analysis/{response,cloudflare-provider,get-provider}.ts` — same shape, same fail-closed credential check, same `AbortSignal.timeout`, same `max_tokens`. The only differences: the Zod schema is `ResearchImportSchema` instead of `InvestmentAnalysisResultSchema`, the model config task is `"structure_research"`, and the env var gating mock vs. real is `RESEARCH_STRUCTURING_PROVIDER` (separate from `ANALYSIS_PROVIDER`, since a deployment might want mock for one task and real for the other during rollout).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/research-structuring-response.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseStructuringResponse } from "@/lib/ai/research-structuring/response";

function validPayload() {
  return {
    company: { ticker: "9432.T", name: "NTT, Inc.", exchange: "Tokyo" },
    researchDate: "2026-08-22",
    sources: [
      { sourceKey: "src_1", sourceType: "chatgpt", sourceName: "ChatGPT Deep Research", evidenceClass: "fact" },
    ],
    financials: [
      {
        sourceKey: "src_1",
        metricKey: "revenue",
        value: 100,
        periodType: "FY",
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
      },
    ],
    managementStatements: [],
    catalysts: [],
    risks: [],
    investorOpinions: [],
    events: [],
    summary: "Steady growth quarter.",
  };
}

describe("parseStructuringResponse", () => {
  it("parses a raw JSON string with no markdown fencing", () => {
    const result = parseStructuringResponse(JSON.stringify(validPayload()));
    expect(result.company.name).toBe("NTT, Inc.");
    expect(result.financials).toHaveLength(1);
  });

  it("accepts an already-parsed object (Cloudflare models sometimes return an object, not a string)", () => {
    const result = parseStructuringResponse(validPayload());
    expect(result.summary).toBe("Steady growth quarter.");
  });

  it("throws a descriptive error when a financials entry uses a metricKey outside the allowed list", () => {
    const invalid = { ...validPayload(), financials: [{ ...validPayload().financials[0], metricKey: "made_up_metric" }] };
    expect(() => parseStructuringResponse(JSON.stringify(invalid))).toThrow();
  });

  it("throws a descriptive error when required company fields are missing", () => {
    const invalid = { ...validPayload(), company: { ticker: "9432.T" } };
    expect(() => parseStructuringResponse(JSON.stringify(invalid))).toThrow();
  });

  it("throws a descriptive error for text with no JSON object at all", () => {
    expect(() => parseStructuringResponse("I could not extract anything.")).toThrow(/JSON/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/research-structuring-response.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/research-structuring/response'`

- [ ] **Step 3: Write the response parser**

Create `src/lib/ai/research-structuring/response.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/research-structuring-response.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the Cloudflare provider**

Create `src/lib/ai/research-structuring/cloudflare-provider.ts`:

```typescript
import "server-only";
import type { ResearchImportInput } from "@/lib/evidence/schemas";
import type { ResearchStructuringProvider, StructuringInput } from "./provider";
import { parseStructuringResponse } from "./response";
import { buildStructuringSystemPrompt, buildStructuringUserPrompt } from "./prompt";

interface CloudflareAiRunResponse {
  result?: { response?: unknown };
  success: boolean;
  errors?: Array<{ message: string }>;
}

export class CloudflareResearchStructuringProvider implements ResearchStructuringProvider {
  readonly modelName: string;
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(accountId: string, apiToken: string, model: string, maxTokens: number, timeoutMs: number) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.modelName = model;
    this.maxTokens = maxTokens;
    this.timeoutMs = timeoutMs;
  }

  async structureResearch(input: StructuringInput): Promise<ResearchImportInput> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: buildStructuringSystemPrompt() },
          { role: "user", content: buildStructuringUserPrompt(input) },
        ],
        max_tokens: this.maxTokens,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`Cloudflare Workers AI structuring request failed: ${res.status} ${bodyText.slice(0, 300)}`);
    }

    const body = (await res.json()) as CloudflareAiRunResponse;
    if (!body.success || !body.result?.response) {
      const message = body.errors?.map((e) => e.message).join("; ") ?? "no response text";
      throw new Error(`Cloudflare Workers AI structuring returned no usable response: ${message}`);
    }

    return parseStructuringResponse(body.result.response);
  }
}
```

- [ ] **Step 6: Write the provider factory**

Create `src/lib/ai/research-structuring/get-provider.ts`:

```typescript
import "server-only";
import type { ResearchStructuringProvider } from "./provider";
import { MockResearchStructuringProvider } from "./provider";
import { CloudflareResearchStructuringProvider } from "./cloudflare-provider";
import { getAiModelConfig } from "@/lib/ai/model-config";

let cached: ResearchStructuringProvider | null = null;

export function getResearchStructuringProvider(): ResearchStructuringProvider {
  if (cached) return cached;

  if (process.env.RESEARCH_STRUCTURING_PROVIDER === "mock") {
    cached = new MockResearchStructuringProvider();
    return cached;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    // src/lib/ai/investment-analysis/get-provider.tsと同じfail-closed方針。
    // 認証情報欠如時に黙ってmockへフォールバックすると、本番の設定漏れが「構造化成功」として
    // 記録されてしまう。mockを使いたい場合はRESEARCH_STRUCTURING_PROVIDER=mockを明示させる。
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set to use the Cloudflare research structuring provider. " +
        "Set RESEARCH_STRUCTURING_PROVIDER=mock explicitly if a mock result is intended."
    );
  }

  const { model, maxTokens, timeoutMs } = getAiModelConfig("structure_research");
  cached = new CloudflareResearchStructuringProvider(accountId, apiToken, model, maxTokens, timeoutMs);
  return cached;
}
```

- [ ] **Step 7: Run the full test suite to verify no regression**

Run: `npx vitest run`
Expected: PASS (all tests, count = previous total + 5 new from this task)

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/research-structuring/response.ts src/lib/ai/research-structuring/cloudflare-provider.ts src/lib/ai/research-structuring/get-provider.ts tests/unit/research-structuring-response.test.ts
git commit -m "feat: add Cloudflare research structuring provider"
```

---

### Task 5: API route to structure a paste_text report in place

**Files:**
- Modify: `src/server/repositories/instruments-repository.ts` (add `findInstrumentById`)
- Create: `src/app/api/research/reports/[id]/structure/route.ts`

**Interfaces:**
- Consumes: `getResearchStructuringProvider` (Task 4), `deleteResearchReport`/`insertJsonImport` (existing, `@/server/repositories/evidence-repository.ts`), `findInstrumentById` (this task).
- Produces: `POST /api/research/reports/[id]/structure` → `{ data: { reportId: string, sourcesCreated: number } }` on success.

No unit tests for this route (matches the established convention for repository/route I/O code — see Global Constraints). This task is verified live in Task 6.

The route "upgrades" an existing `paste_text` report in place: it structures the report's `raw_content`, validates the result, deletes the old paste report (and its now-unreferenced source row, via the existing `deleteResearchReport`), and inserts the structured data as a new `json`-mode report via the existing `insertJsonImport` (which creates its own new sources + report + cascaded evidence rows). This keeps exactly one list entry per piece of research instead of leaving a duplicate, and reuses two already-tested, already-live-verified code paths instead of writing a third insert/delete variant.

- [ ] **Step 1: Add `findInstrumentById`**

In `src/server/repositories/instruments-repository.ts`, add after `findInstrumentByProviderSymbol`:

```typescript
export async function findInstrumentById(
  supabase: SupabaseClient<Database>,
  instrumentId: string
): Promise<InstrumentRow | null> {
  const { data, error } = await supabase.from("instruments").select("*").eq("id", instrumentId).maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Write the route**

Create `src/app/api/research/reports/[id]/structure/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/errors/api-error";
import { findInstrumentById } from "@/server/repositories/instruments-repository";
import { deleteResearchReport, insertJsonImport } from "@/server/repositories/evidence-repository";
import { getResearchStructuringProvider } from "@/lib/ai/research-structuring/get-provider";

// cloudflare-provider.tsのfetchタイムアウト（既定60秒）より前にVercelがFunctionを強制終了しないよう、
// src/app/api/analysis/run/route.tsと同じ理由で明示的に延長する。
export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED");

  const { data: report, error: reportError } = await supabase
    .from("research_reports")
    .select("id, instrument_id, import_mode, research_date, raw_content, imported_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (reportError) {
    console.error("POST /api/research/reports/[id]/structure failed (fetch report):", reportError);
    return apiError("INTERNAL_ERROR");
  }
  if (!report) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");
  if (report.import_mode !== "paste_text") {
    return apiError("INVALID_REQUEST", "貼り付けモードの資料のみAI構造化できます。");
  }

  const instrument = await findInstrumentById(supabase, report.instrument_id).catch(() => null);
  if (!instrument) return apiError("NOT_FOUND", "紐づく銘柄が見つかりませんでした。");

  try {
    const provider = getResearchStructuringProvider();
    const structured = await provider.structureResearch({
      rawContent: report.raw_content,
      company: {
        ticker: instrument.provider_symbol,
        name: instrument.name,
        // 手入力ファンド（provider='manual'）はexchangeが未設定のことがある。company.exchangeは
        // ResearchImportSchemaで必須（最小1文字）のため、instrument.marketから妥当な既定値を補う
        // （リサーチ内容の捏造ではなく、既にDBにある構造メタデータからの補完）。
        exchange: instrument.exchange ?? (instrument.market === "JP" ? "Tokyo" : "US Market"),
      },
      researchDate: report.research_date ?? report.imported_at.slice(0, 10),
    });

    const deleted = await deleteResearchReport(supabase, user.id, report.id);
    if (!deleted) return apiError("NOT_FOUND", "指定されたリサーチ資料が見つかりませんでした。");

    const result = await insertJsonImport(supabase, user.id, report.instrument_id, structured);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/research/reports/[id]/structure failed:", err);
    return apiError("INTERNAL_ERROR");
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run the full test suite to verify no regression**

Run: `npx vitest run`
Expected: PASS (no new tests in this task, count unchanged from Task 4)

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/instruments-repository.ts src/app/api/research/reports/[id]/structure/route.ts
git commit -m "feat: add POST /api/research/reports/[id]/structure to AI-structure a pasted report"
```

---

### Task 6: UI — "AI構造化" button in the research report modal

**Files:**
- Modify: `src/components/research/ResearchReportModal.tsx`

**Interfaces:**
- Consumes: `POST /api/research/reports/[id]/structure` (Task 5).

No unit test for this task (the codebase's existing convention has no component tests for the other research-report UI pieces either — `ResearchImportForm.tsx`, `ManualMetricForm.tsx` are untested the same way). Verified live in the Task 6 live-verification step below, which is part of this task, not deferred.

- [ ] **Step 1: Add the structuring mutation and button**

In `src/components/research/ResearchReportModal.tsx`, add a new mutation next to the existing `updateMutation`/`deleteMutation`, and a button next to "編集" that only shows for `paste_text` reports:

```typescript
async function structureReport(id: string) {
  const res = await fetch(`/api/research/reports/${id}/structure`, { method: "POST" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `structure failed: ${res.status}`);
  }
  return res.json();
}
```

Add this function above the `ResearchReportModal` component (next to the existing `patchReport`/`deleteReport` functions).

Inside the component, add a new mutation next to `updateMutation`/`deleteMutation`:

```typescript
  const structureMutation = useMutation({
    mutationFn: () => structureReport(report.id),
    onSuccess: () => {
      router.refresh();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });
```

In the footer's `isEditable ? (...) : null` block, add the structuring button before the edit button (only visible when not already editing and not in the delete-confirm state), so the footer becomes:

```tsx
          {isEditable ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setRawContent(report.rawContent);
                    setError(null);
                  }}
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || rawContent.trim().length === 0}
                  className="rounded-button bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  {updateMutation.isPending ? "保存中..." : "保存する"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => structureMutation.mutate()}
                  disabled={structureMutation.isPending}
                  title="本文をAIが読み取り、財務指標・経営陣発言・カタリスト・リスク等に自動分類します"
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {structureMutation.isPending ? "AI構造化中..." : "AIで構造化"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-button border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
                >
                  編集
                </button>
              </div>
            )
          ) : null}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run the full test suite to verify no regression**

Run: `npx vitest run`
Expected: PASS (no new tests in this task)

- [ ] **Step 4: Live-verify against production data**

This step is not optional — every prior phase of this project found at least one real bug only through live verification (see `.superpowers/sdd/progress.md`). Using the dev server against the real Supabase project (same pattern as every previous phase):

1. Start the dev server, log in, navigate to a stock with an existing `paste_text` research report (e.g. NTT / 9432.T).
2. Open the report, click "AIで構造化", wait for it to complete.
3. Confirm: the modal closes, the report list now shows the report with a `summary` line (proof it's now `json`-mode), and the old raw-only entry is gone (not duplicated).
4. Query the DB directly (service-role script, same pattern as prior phases) to confirm `financial_metrics`/`management_statements`/etc. rows now exist for this `instrument_id` with `source_report_id` pointing at the new report.
5. Re-run `/api/analysis/run` for the same symbol and confirm the AI analysis result no longer lists "financial metrics" as a data gap (assuming the source text contained extractable numbers) and that `dataGaps` reflects only genuinely-missing categories.
6. Clean up: this step uses real data the user already owns (their actual pasted research), so there is nothing to delete afterward — do not delete the newly-structured evidence.

- [ ] **Step 5: Commit**

```bash
git add src/components/research/ResearchReportModal.tsx
git commit -m "feat: add AI-structure button to the research report modal"
```

---

### Final Phase Review

After all 6 tasks are committed and live-verified, dispatch a final whole-branch review (or, if working solo without subagents, do a careful self-review) covering:

- Does the structuring prompt's metricKey list in `prompt.ts` stay in sync with `metricKeyValues` in `schemas.ts` (it's imported, not copy-pasted, so this should hold automatically — verify the import is actually used, not a stale copy)?
- Does `deleteResearchReport` really only delete the OLD paste report's own source, not a source shared with something else (re-read its "only delete if unreferenced elsewhere" logic from the P7-adjacent delete/edit feature already shipped)?
- Is there any path where `insertJsonImport` runs but the earlier `deleteResearchReport` failed silently, leaving a duplicate? (Both are awaited with `throw` on error inside the same `try` block, so a `deleteResearchReport` failure should already abort before `insertJsonImport` runs — confirm this by reading the route's control flow once more.)
- Confirm `RESEARCH_STRUCTURING_PROVIDER=mock` and `ANALYSIS_PROVIDER=mock` are independently settable (they must be, since a deployment might want one real and one mocked during rollout) — this was a design constraint, not just an implementation detail, so verify the two get-provider.ts files never share env-var names.

Then use `superpowers:finishing-a-development-branch` to decide how to land this (this branch already has an open PR — #2 — so the natural continuation is pushing these commits onto the same `feature/investment-intelligence-p1` branch, which updates PR #2 automatically, rather than opening a third PR).
