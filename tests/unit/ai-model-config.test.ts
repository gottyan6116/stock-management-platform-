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
