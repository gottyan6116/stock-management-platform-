# Investment Intelligence — Phase P5: Deterministic Quantitative Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a deterministic, explainable 0–70 point quantitative score from an `InvestmentEvidence` packet's `financials` array (Phase P4), broken into 6 weighted categories (Growth 15 / Profitability 15 / Financial Health 10 / Cash Flow 10 / Valuation 15 / Shareholder Return 5 = 70), with **no AI call involved** — this is the deterministic half of the eventual "Quant Score + Qualitative Score" split (Phase P6 adds the AI-scored qualitative half separately). Same input always produces the same output; missing data produces `null` for that category, never a fabricated `0`.

**Architecture:** One pure, synchronous module (`src/lib/scoring/quant-score.ts`) — no I/O, no Supabase, no network — taking a `FinancialMetric[]` (the same domain type Phase P4's `InvestmentEvidence.financials` already carries) and returning a `QuantScoreBreakdown`. Fully unit-testable, following the precedent Phase P4 set for pure-function code in this codebase.

**Tech Stack:** Same as P1–P4. No new dependencies.

## Global Constraints

- `missing != 0`: every category's `score` field is `number | null`. `null` means "not enough data to score this category," and must never be silently treated as `0` anywhere in this module. The overall `total` sums only the categories that have a non-null score; it does not average in a `0` for missing categories.
- Every category carries a human-readable `reason` string citing which metric(s) and value(s) it used (or that no data was available) — this is what will eventually back a "why this score" UI (out of scope for this phase, but the field must exist and be populated now, per the master design's transparency requirement).
- All scoring bands (the numeric thresholds that map a raw metric value to points) are named constants with a comment stating the rationale is "reasonable, documented judgment calls for an MVP scoring rubric" — not empirically derived, and expected to be tunable later without changing the module's shape.
- Reuse `FinancialMetric`/`MetricKey` from `src/types/evidence.ts` — do not redeclare.
- No I/O: this module must not import `@supabase/supabase-js`, perform `fetch`, or be `async` anywhere.
- After every code step: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit` must pass with zero errors.
- Work happens in the existing worktree/branch (`feature/investment-intelligence-p1`), continuing directly on top of P4's commits. Do not create a new worktree or branch.

---

### Task 1: Quant scoring module + unit tests

**Files:**
- Create: `src/lib/scoring/quant-score.ts`
- Test: `tests/unit/quant-score.test.ts`

**Interfaces:**
- Consumes: `FinancialMetric`, `MetricKey` from `src/types/evidence.ts`.
- Produces: `CategoryScore`, `QuantScoreBreakdown` types, `computeQuantScore(financials: FinancialMetric[]): QuantScoreBreakdown` — consumed by Phase P6 (which will call this alongside the Cloudflare AI qualitative score to build the final combined result).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/quant-score.test.ts
import { describe, expect, it } from "vitest";
import { computeQuantScore } from "@/lib/scoring/quant-score";
import type { FinancialMetric, MetricKey } from "@/types/evidence";

let nextId = 1;
function metric(
  metricKey: MetricKey,
  value: number,
  periodEnd: string,
  periodStart = "2024-04-01"
): FinancialMetric {
  return {
    id: `m${nextId++}`,
    instrumentId: "inst-1",
    metricKey,
    value,
    unit: null,
    currency: null,
    periodType: "FY",
    periodStart,
    periodEnd,
    reportedAt: null,
    sourceId: null,
    sourceReportId: null,
    isManual: true,
    createdAt: "2026-08-20T00:00:00Z",
  };
}

describe("computeQuantScore", () => {
  it("returns null for every category and total when given no financials", () => {
    const result = computeQuantScore([]);
    expect(result.growth.score).toBeNull();
    expect(result.profitability.score).toBeNull();
    expect(result.financialHealth.score).toBeNull();
    expect(result.cashFlow.score).toBeNull();
    expect(result.valuation.score).toBeNull();
    expect(result.shareholderReturn.score).toBeNull();
    expect(result.total).toBeNull();
    expect(result.maxTotal).toBe(70);
  });

  it("scores growth as null with a single revenue data point (no prior period to compare)", () => {
    const result = computeQuantScore([metric("revenue", 1000, "2026-03-31")]);
    expect(result.growth.score).toBeNull();
    expect(result.growth.reason).toContain("revenue");
  });

  it("scores growth from two revenue periods, clamped at the 0%/15% band", () => {
    const flat = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 1000, "2026-03-31"),
    ]);
    expect(flat.growth.score).toBeCloseTo(0, 5);

    const strong = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 1200, "2026-03-31"),
    ]);
    expect(strong.growth.score).toBeCloseTo(15, 5);

    const negative = computeQuantScore([
      metric("revenue", 1000, "2025-03-31"),
      metric("revenue", 900, "2026-03-31"),
    ]);
    expect(negative.growth.score).toBeCloseTo(0, 5);
  });

  it("scores profitability from operating_margin and roe as the average of both bands", () => {
    const result = computeQuantScore([
      metric("operating_margin", 10, "2026-03-31"), // midpoint of 0-20 band -> 0.5 fraction
      metric("roe", 20, "2026-03-31"), // top of 0-20 band -> 1.0 fraction
    ]);
    // average fraction = 0.75 -> 0.75 * 15 = 11.25
    expect(result.profitability.score).toBeCloseTo(11.25, 5);
  });

  it("scores profitability from only operating_margin when roe is absent, without penalizing for the missing metric", () => {
    const result = computeQuantScore([metric("operating_margin", 20, "2026-03-31")]);
    expect(result.profitability.score).toBeCloseTo(15, 5);
  });

  it("inverts valuation metrics so a lower PER scores higher", () => {
    const cheap = computeQuantScore([metric("per", 10, "2026-03-31")]);
    const expensive = computeQuantScore([metric("per", 30, "2026-03-31")]);
    expect(cheap.valuation.score).toBeGreaterThan(expensive.valuation.score ?? 0);
  });

  it("computes total as the sum of non-null category scores only, never inflating with a fabricated zero", () => {
    const result = computeQuantScore([
      metric("operating_margin", 20, "2026-03-31"), // profitability -> full 15 (roe absent, no penalty)
      metric("dividend_yield", 4, "2026-03-31"), // shareholderReturn -> full 5
    ]);
    expect(result.profitability.score).toBeCloseTo(15, 5);
    expect(result.shareholderReturn.score).toBeCloseTo(5, 5);
    expect(result.growth.score).toBeNull();
    expect(result.financialHealth.score).toBeNull();
    expect(result.cashFlow.score).toBeNull();
    expect(result.valuation.score).toBeNull();
    expect(result.total).toBeCloseTo(20, 5);
    expect(result.maxTotal).toBe(70);
  });

  it("every category carries a non-empty reason string", () => {
    const result = computeQuantScore([metric("roe", 15, "2026-03-31")]);
    for (const category of [
      result.growth,
      result.profitability,
      result.financialHealth,
      result.cashFlow,
      result.valuation,
      result.shareholderReturn,
    ]) {
      expect(category.reason.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/quant-score.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scoring/quant-score'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/scoring/quant-score.ts
import type { FinancialMetric, MetricKey } from "@/types/evidence";

export interface CategoryScore {
  score: number | null;
  maxScore: number;
  reason: string;
}

export interface QuantScoreBreakdown {
  growth: CategoryScore;
  profitability: CategoryScore;
  financialHealth: CategoryScore;
  cashFlow: CategoryScore;
  valuation: CategoryScore;
  shareholderReturn: CategoryScore;
  total: number | null;
  maxTotal: number;
}

/** 指定したmetric_keyの中で最新期末日のFinancialMetricを返す（同一期末日が複数あれば最初に見つかったもの）。 */
function latestMetric(financials: FinancialMetric[], key: MetricKey): FinancialMetric | null {
  const matches = financials.filter((m) => m.metricKey === key);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.periodEnd >= b.periodEnd ? a : b));
}

/** 直近2つの異なる期末日のYoY成長率(%)。データ不足（異なる期が2件未満）ならnull。 */
function yoyGrowthPercent(financials: FinancialMetric[], key: MetricKey): number | null {
  const matches = financials.filter((m) => m.metricKey === key);
  const distinctPeriods = Array.from(new Set(matches.map((m) => m.periodEnd))).sort();
  if (distinctPeriods.length < 2) return null;
  const latestPeriod = distinctPeriods[distinctPeriods.length - 1]!;
  const previousPeriod = distinctPeriods[distinctPeriods.length - 2]!;
  const latestValue = matches.find((m) => m.periodEnd === latestPeriod)?.value;
  const previousValue = matches.find((m) => m.periodEnd === previousPeriod)?.value;
  if (latestValue === undefined || previousValue === undefined || previousValue === 0) return null;
  return ((latestValue - previousValue) / Math.abs(previousValue)) * 100;
}

/** value を [low, high] の範囲で0〜1に線形正規化し、[0,1]にクランプする。invertなら反転（低いほど良い指標向け）。 */
function normalize(value: number, low: number, high: number, invert = false): number {
  const ratio = (value - low) / (high - low);
  const clamped = Math.max(0, Math.min(1, ratio));
  return invert ? 1 - clamped : clamped;
}

interface SubMetricSpec {
  key: MetricKey;
  low: number;
  high: number;
  invert?: boolean;
}

/**
 * specsで指定した各指標の直近値を[0,1]に正規化し、取得できたものだけの平均をmaxScoreに掛けて返す。
 * データが1件も取れなければ null（missing != 0 を守る — 取得できた指標だけで平均するため、
 * 一部の指標が欠けていても他方が満点ならカテゴリ満点になり得る）。
 */
function categoryScore(financials: FinancialMetric[], specs: SubMetricSpec[], maxScore: number): CategoryScore {
  const fractions: number[] = [];
  const details: string[] = [];
  for (const spec of specs) {
    const metric = latestMetric(financials, spec.key);
    if (!metric) continue;
    fractions.push(normalize(metric.value, spec.low, spec.high, spec.invert));
    details.push(`${spec.key}=${metric.value}`);
  }
  if (fractions.length === 0) {
    return { score: null, maxScore, reason: `no data (needs one of: ${specs.map((s) => s.key).join(", ")})` };
  }
  const avgFraction = fractions.reduce((a, b) => a + b, 0) / fractions.length;
  return { score: avgFraction * maxScore, maxScore, reason: details.join(", ") };
}

// 以下の閾値はMVP向けの合理的な判断値であり、実証的に導出したものではない。
// 将来チューニングする場合もこのモジュールの型・関数シグネチャは変えずに定数だけ調整できるようにする。
const GROWTH_MAX = 15;
const PROFITABILITY_MAX = 15;
const FINANCIAL_HEALTH_MAX = 10;
const CASH_FLOW_MAX = 10;
const VALUATION_MAX = 15;
const SHAREHOLDER_RETURN_MAX = 5;

function scoreGrowth(financials: FinancialMetric[]): CategoryScore {
  const revenueGrowth = yoyGrowthPercent(financials, "revenue");
  if (revenueGrowth !== null) {
    const fraction = normalize(revenueGrowth, 0, 15);
    return { score: fraction * GROWTH_MAX, maxScore: GROWTH_MAX, reason: `revenue YoY growth ${revenueGrowth.toFixed(1)}%` };
  }
  const epsGrowth = yoyGrowthPercent(financials, "eps");
  if (epsGrowth !== null) {
    const fraction = normalize(epsGrowth, 0, 15);
    return { score: fraction * GROWTH_MAX, maxScore: GROWTH_MAX, reason: `eps YoY growth ${epsGrowth.toFixed(1)}%` };
  }
  return { score: null, maxScore: GROWTH_MAX, reason: "no data (needs revenue or eps in at least 2 periods)" };
}

export function computeQuantScore(financials: FinancialMetric[]): QuantScoreBreakdown {
  const growth = scoreGrowth(financials);
  const profitability = categoryScore(
    financials,
    [
      { key: "operating_margin", low: 0, high: 20 },
      { key: "roe", low: 0, high: 20 },
    ],
    PROFITABILITY_MAX
  );
  const financialHealth = categoryScore(
    financials,
    [
      { key: "current_ratio", low: 1, high: 2 },
      { key: "net_debt_ebitda", low: 0, high: 3, invert: true },
    ],
    FINANCIAL_HEALTH_MAX
  );
  const cashFlow = categoryScore(
    financials,
    [
      { key: "fcf_margin", low: 0, high: 15 },
      { key: "fcf_yield", low: 0, high: 8 },
    ],
    CASH_FLOW_MAX
  );
  const valuation = categoryScore(
    financials,
    [
      { key: "per", low: 10, high: 30, invert: true },
      { key: "pbr", low: 0.5, high: 3, invert: true },
    ],
    VALUATION_MAX
  );
  const shareholderReturn = categoryScore(financials, [{ key: "dividend_yield", low: 0, high: 4 }], SHAREHOLDER_RETURN_MAX);

  const categories = [growth, profitability, financialHealth, cashFlow, valuation, shareholderReturn];
  const scored = categories.filter((c): c is CategoryScore & { score: number } => c.score !== null);
  const total = scored.length > 0 ? scored.reduce((sum, c) => sum + c.score, 0) : null;

  return {
    growth,
    profitability,
    financialHealth,
    cashFlow,
    valuation,
    shareholderReturn,
    total,
    maxTotal: GROWTH_MAX + PROFITABILITY_MAX + FINANCIAL_HEALTH_MAX + CASH_FLOW_MAX + VALUATION_MAX + SHAREHOLDER_RETURN_MAX,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx vitest run tests/unit/quant-score.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 5: Type-check and full suite**

Run: `cd C:\Users\takas\dev\stockscope\.worktrees\investment-intelligence-p1 && npx tsc --noEmit && npx vitest run`
Expected: zero type errors, all tests passing (145 existing + 8 new = 153).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring/quant-score.ts tests/unit/quant-score.test.ts
git commit -m "feat: add deterministic quantitative scoring module"
```

---

## Definition of Done for Phase P5

- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npx vitest run` passes with zero failures (153 tests).
- [ ] No existing file was modified — this phase adds exactly two new files.

## What's Deliberately Not in This Phase

No AI/qualitative scoring (Phase P6). No UI display of the score. No `analysis_runs` persistence (Phase P6, when the AI call and the quant score are combined into one stored result). No orchestration wiring this into the Evidence Builder's output — Phase P6's route will call `buildInvestmentEvidence(...).financials` and pass that straight into `computeQuantScore(...)`, so no glue code is needed here.
