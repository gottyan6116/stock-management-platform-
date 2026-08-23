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
