import { z } from "zod";
import { SCENARIO_KEYS, type ScenarioInput, type ScenarioKey } from "./expected-return";

export type ScenarioInputs = Record<ScenarioKey, ScenarioInput>;

export function emptyScenarios(): ScenarioInputs {
  return {
    bear: { epsGrowthPct: null, exitPer: null },
    base: { epsGrowthPct: null, exitPer: null },
    bull: { epsGrowthPct: null, exitPer: null },
  };
}

const nullableNumber = z.number().finite().nullable();

const scenarioInputSchema = z.object({
  epsGrowthPct: nullableNumber.refine((v) => v === null || (v > -100 && v <= 200), "EPS成長率は−100%〜200%で入力してください。"),
  exitPer: nullableNumber.refine((v) => v === null || (v > 0 && v <= 500), "5年後PERは0より大きく500以下で入力してください。"),
});

export const scenarioInputsSchema = z.object({
  bear: scenarioInputSchema,
  base: scenarioInputSchema,
  bull: scenarioInputSchema,
});

/** DBのjsonb（形が崩れていても落ちない）から入力値を取り出す。読めない項目は空欄に戻す。 */
export function parseScenarios(raw: unknown): ScenarioInputs {
  const result = emptyScenarios();
  if (typeof raw !== "object" || raw === null) return result;
  for (const key of SCENARIO_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    const parsed = scenarioInputSchema.safeParse(value);
    if (parsed.success) result[key] = parsed.data;
  }
  return result;
}
