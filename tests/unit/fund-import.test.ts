import { describe, expect, it } from "vitest";
import { planFundImport } from "@/lib/import/plan-fund-import";
import {
  dateFromFileName,
  mapAccountLabel,
  normalizeFundName,
  parseRakutenFundCsv,
} from "@/lib/import/rakuten-fund-csv";

const HEADER =
  "投資信託種別,口座区分,ファンド,分配金コース,保有数量[口],(内訳　通常数量[口]),(内訳　積立数量[口]),平均取得価額[円],取得総額[円],基準価額[円],基準価額(前日比)[円],基準価額(前月比)[円],時価評価額[円],評価損益[円],評価損益[％],トータルリターン[円],通貨単位,未収分配金,参考為替レート,時価評価額[外貨],合計額[円]";

function line(account: string, name: string, qty: string, avg: string, nav: string, type = "投資信託") {
  return `"${type}","${account}","${name}","再投資型","${qty}","0","${qty}","${avg}","100,000","${nav}","-1","-2","1","1","1","1","-","-","-","-","-"`;
}

const csv = [
  HEADER,
  line("NISAつみたて投資枠", "ニッセイ 外国株式インデックスファンド＜購入・換金手数料なし＞", "10,000", "40,000.50", "50,000"),
  line("NISA成長投資枠", "テスト・ファンド(新規)", "1,234", "20,000", "21,000"),
].join("\r\n");

describe("parseRakutenFundCsv", () => {
  it("reads quoted numbers with thousands separators, per-10,000-unit prices and accounts", () => {
    const result = parseRakutenFundCsv(csv);
    expect(result.fatal).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        name: "ニッセイ 外国株式インデックスファンド＜購入・換金手数料なし＞",
        nisaType: "tsumitate",
        accountLabel: "NISAつみたて投資枠",
        quantity: 10000,
        avgCostPer10k: 40000.5,
        nav: 50000,
        totalCost: 100000,
      },
      expect.objectContaining({ nisaType: "growth", quantity: 1234, avgCostPer10k: 20000, nav: 21000 }),
    ]);
  });

  it("rejects a CSV that is not the fund holdings export, with a next action", () => {
    const result = parseRakutenFundCsv("銘柄コード,銘柄名\n7203,トヨタ");
    expect(result.rows).toEqual([]);
    expect(result.fatal).toContain("CSVで保存");
  });

  it("keeps unreadable rows out and says why instead of importing zeros", () => {
    const result = parseRakutenFundCsv(
      [
        HEADER,
        line("旧つみたてNISA", "旧口座ファンド", "1", "1", "1"),
        line("NISAつみたて投資枠", "数量なし", "-", "1", "1"),
        line("NISAつみたて投資枠", "外貨MMF", "1", "1", "1", "外貨建MMF"),
      ].join("\n")
    );
    expect(result.rows).toEqual([]);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toContain("未対応");
  });

  it("treats a missing NAV as null, never zero", () => {
    const result = parseRakutenFundCsv([HEADER, line("特定", "課税ファンド", "10", "1,000", "-")].join("\n"));
    expect(result.rows[0]).toMatchObject({ nisaType: null, nav: null });
  });
});

describe("mapAccountLabel / normalizeFundName / dateFromFileName", () => {
  it("maps accounts and flags the legacy tsumitate NISA as unsupported", () => {
    expect(mapAccountLabel("NISAつみたて投資枠")).toBe("tsumitate");
    expect(mapAccountLabel("NISA成長投資枠")).toBe("growth");
    expect(mapAccountLabel("特定")).toBeNull();
    expect(mapAccountLabel("旧つみたてNISA")).toBe("unsupported");
  });

  it("absorbs spacing and bracket differences between Rakuten and the registered name", () => {
    expect(normalizeFundName("ニッセイ 外国株式インデックスファンド＜購入・換金手数料なし＞")).toBe(
      normalizeFundName("ニッセイ外国株式インデックスファンド<購入・換金手数料なし>")
    );
  });

  it("reads the as-of date from the file name", () => {
    expect(dateFromFileName("assetbalance(INVST)_20260930_175957.csv")).toBe("2026-09-30");
    expect(dateFromFileName("holdings.csv")).toBeNull();
  });
});

describe("planFundImport", () => {
  const rows = parseRakutenFundCsv(csv).rows;
  const instruments = [{ id: "i-nissay", name: "ニッセイ外国株式インデックスファンド<購入・換金手数料なし>" }];

  it("updates a matched lot, creates a missing fund, and never touches positions absent from the CSV", () => {
    const plan = planFundImport(rows, instruments, [
      { id: "p1", instrumentId: "i-nissay", nisaType: "tsumitate", quantity: 9000, avgCost: 39000, manualUnitPrice: 48000 },
      { id: "p2", instrumentId: "i-other", nisaType: "growth", quantity: 5, avgCost: 1, manualUnitPrice: 1 },
    ]);

    expect(plan.items[0]).toMatchObject({
      action: "update",
      instrumentId: "i-nissay",
      positionId: "p1",
      before: { quantity: 9000, avgCost: 39000, nav: 48000 },
    });
    expect(plan.items[1]).toMatchObject({ action: "create", instrumentId: null, positionId: null });
    expect(plan.untouchedCount).toBe(1);
  });

  it("reports a lot that already matches as unchanged, so re-importing the same file is a no-op", () => {
    const plan = planFundImport(rows.slice(0, 1), instruments, [
      { id: "p1", instrumentId: "i-nissay", nisaType: "tsumitate", quantity: 10000, avgCost: 40000.5, manualUnitPrice: 50000 },
    ]);
    expect(plan.items[0]!.action).toBe("unchanged");
  });

  it("does not confuse the same fund held in a different account", () => {
    const plan = planFundImport(rows.slice(0, 1), instruments, [
      { id: "p1", instrumentId: "i-nissay", nisaType: "growth", quantity: 10000, avgCost: 40000.5, manualUnitPrice: 50000 },
    ]);
    expect(plan.items[0]).toMatchObject({ action: "create", instrumentId: "i-nissay", positionId: null });
  });

  it("skips duplicate fund+account rows in the CSV with a warning", () => {
    const plan = planFundImport([rows[0]!, rows[0]!], instruments, []);
    expect(plan.items).toHaveLength(1);
    expect(plan.warnings[0]).toContain("複数");
  });
});
