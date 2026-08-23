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

  it("lists the exact allowed sourceType, topic, and eventType values (regression: the model previously invented a sourceType outside the enum and failed schema validation)", () => {
    const prompt = buildStructuringSystemPrompt();
    expect(prompt).toContain("chatgpt");
    expect(prompt).toContain("official_ir");
    expect(prompt).toContain("guidance");
    expect(prompt).toContain("shareholder_return");
    expect(prompt).toContain("earnings");
    expect(prompt).toContain("management_change");
  });

  it("instructs the model to write free-text fields in the same language as the source text (regression: summaries were coming back in English for Japanese input)", () => {
    const prompt = buildStructuringSystemPrompt();
    expect(prompt).toMatch(/same language/i);
  });

  it("instructs the model never to rescale a financial figure and to record the original unit instead (regression: '3,650億円' was extracted as value 365 -- a wrong order of magnitude -- because the prompt never explained the unit field)", () => {
    const prompt = buildStructuringSystemPrompt();
    expect(prompt).toMatch(/never convert or rescale/i);
    expect(prompt).toContain("JPY_100M");
  });
});

describe("buildStructuringUserPrompt", () => {
  it("embeds the company identity, research date, raw content, and known source", () => {
    const prompt = buildStructuringUserPrompt({
      rawContent: "NTTの2026年度1Q決算は営業収益+10.9%、営業利益+4.9%で増収増益だった。",
      company: { ticker: "9432.T", name: "NTT, Inc.", exchange: "Tokyo" },
      researchDate: "2026-08-22",
      knownSource: { sourceName: "ChatGPT", sourceType: "chatgpt" },
    });
    expect(prompt).toContain("9432.T");
    expect(prompt).toContain("NTT, Inc.");
    expect(prompt).toContain("2026-08-22");
    expect(prompt).toContain("NTTの2026年度1Q決算");
    expect(prompt).toContain("ChatGPT");
    expect(prompt).toContain("chatgpt");
  });
});
