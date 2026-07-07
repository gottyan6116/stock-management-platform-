import { describe, expect, it } from "vitest";
import { findAliasedSymbols } from "@/config/company-aliases";

describe("findAliasedSymbols", () => {
  it("カタカナ社名からticker symbolを解決する", () => {
    expect(findAliasedSymbols("ジョンソンアンドジョンソン")).toContain("JNJ");
  });

  it("部分一致でも解決する", () => {
    expect(findAliasedSymbols("トヨタ")).toContain("7203.T");
  });

  it("1文字では解決しない", () => {
    expect(findAliasedSymbols("ト")).toEqual([]);
  });

  it("一致しない場合は空配列を返す", () => {
    expect(findAliasedSymbols("存在しない会社名")).toEqual([]);
  });
});
