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
