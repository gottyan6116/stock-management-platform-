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
