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
