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
