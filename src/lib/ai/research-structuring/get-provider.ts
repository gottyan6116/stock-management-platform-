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
