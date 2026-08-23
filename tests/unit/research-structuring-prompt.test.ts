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
});

describe("buildStructuringUserPrompt", () => {
  it("embeds the company identity, research date, and raw content", () => {
    const prompt = buildStructuringUserPrompt({
      rawContent: "NTTの2026年度1Q決算は営業収益+10.9%、営業利益+4.9%で増収増益だった。",
      company: { ticker: "9432.T", name: "NTT, Inc.", exchange: "Tokyo" },
      researchDate: "2026-08-22",
    });
    expect(prompt).toContain("9432.T");
    expect(prompt).toContain("NTT, Inc.");
    expect(prompt).toContain("2026-08-22");
    expect(prompt).toContain("NTTの2026年度1Q決算");
  });
});
