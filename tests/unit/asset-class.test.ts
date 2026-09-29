import { describe, expect, it } from "vitest";
import { ASSET_CLASS_LABEL, getAssetClass } from "@/lib/domain/asset-class";

describe("getAssetClass", () => {
  it("classifies a fund as 投資信託 even though the DB stores market='JP' for manual funds (regression 0-2)", () => {
    expect(getAssetClass({ instrumentType: "fund", market: "JP" })).toBe("fund");
    expect(ASSET_CLASS_LABEL[getAssetClass({ instrumentType: "fund", market: "JP" })]).toBe("投資信託");
  });

  it("classifies stocks by market", () => {
    expect(getAssetClass({ instrumentType: "stock", market: "JP" })).toBe("jp_stock");
    expect(getAssetClass({ instrumentType: "stock", market: "US" })).toBe("us_stock");
  });

  it("treats ETFs and indices like stocks of their market, never as funds", () => {
    expect(getAssetClass({ instrumentType: "etf", market: "US" })).toBe("us_stock");
    expect(getAssetClass({ instrumentType: "index", market: "JP" })).toBe("jp_stock");
  });
});
