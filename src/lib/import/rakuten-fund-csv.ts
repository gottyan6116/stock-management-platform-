/**
 * 楽天証券「保有商品一覧（投資信託）」CSVの解析。DBにも画面にも依存しない純粋関数。
 * 文字コード(Shift_JIS)のデコードは呼び出し側で行う（ブラウザなら TextDecoder("shift_jis")）。
 * 値が読めない項目は0にせず null にする。読めない行は捨てず、理由付きで warnings に残す。
 */

export type ImportNisaType = "tsumitate" | "growth" | null;

export interface FundCsvRow {
  /** CSV上のファンド名（表記そのまま） */
  name: string;
  /** null は課税口座（特定・一般） */
  nisaType: ImportNisaType;
  accountLabel: string;
  quantity: number;
  /** 1万口あたり平均取得価額（円）。アプリの保存単位と同じ。 */
  avgCostPer10k: number | null;
  /** 1万口あたり基準価額（円） */
  nav: number | null;
  /** 取得総額（円）。検算用。 */
  totalCost: number | null;
}

export interface FundCsvParseResult {
  rows: FundCsvRow[];
  warnings: string[];
  /** ヘッダーが投資信託CSVの形式でない場合の理由。 */
  fatal: string | null;
}

const REQUIRED_HEADERS = ["口座区分", "ファンド", "保有数量[口]", "平均取得価額[円]", "基準価額[円]"] as const;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "--") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** 口座区分の表記 → nisa_type。対応できない区分は unsupported。 */
export function mapAccountLabel(label: string): ImportNisaType | "unsupported" {
  if (label.includes("旧")) return "unsupported";
  if (label.includes("つみたて投資枠")) return "tsumitate";
  if (label.includes("成長投資枠")) return "growth";
  if (label.includes("特定") || label.includes("一般") || label.includes("課税")) return null;
  return "unsupported";
}

/** ファンド名の照合キー。全角/半角・空白・括弧の種類・大文字小文字の違いを吸収する。 */
export function normalizeFundName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　<>＜＞()（）「」\[\]・･\-‐−ー]/g, "");
}

export function parseRakutenFundCsv(text: string): FundCsvParseResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const headerIndex = lines.findIndex((line) => REQUIRED_HEADERS.every((h) => line.includes(h)));
  if (headerIndex === -1) {
    return {
      rows: [],
      warnings: [],
      fatal:
        "投資信託の保有CSVではないようです。楽天証券の「保有商品（投資信託）」画面の「CSVで保存」で保存したファイルを選んでください。",
    };
  }

  const header = splitCsvLine(lines[headerIndex]!);
  const col = (name: string) => header.indexOf(name);
  const idx = {
    type: col("投資信託種別"),
    account: col("口座区分"),
    name: col("ファンド"),
    quantity: col("保有数量[口]"),
    avgCost: col("平均取得価額[円]"),
    totalCost: col("取得総額[円]"),
    nav: col("基準価額[円]"),
  };

  const rows: FundCsvRow[] = [];
  const warnings: string[] = [];

  lines.slice(headerIndex + 1).forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const lineNo = headerIndex + offset + 2;
    const name = cells[idx.name] ?? "";
    if (name === "") return;

    if (idx.type >= 0 && cells[idx.type] !== "投資信託") {
      warnings.push(`${lineNo}行目「${name}」は投資信託ではないため取り込みません。`);
      return;
    }

    const accountLabel = cells[idx.account] ?? "";
    const nisaType = mapAccountLabel(accountLabel);
    if (nisaType === "unsupported") {
      warnings.push(`${lineNo}行目「${name}」の口座区分「${accountLabel}」は未対応のため取り込みません。`);
      return;
    }

    const quantity = parseNumber(cells[idx.quantity]);
    if (quantity === null || quantity <= 0) {
      warnings.push(`${lineNo}行目「${name}」の保有数量を読み取れないため取り込みません。`);
      return;
    }

    rows.push({
      name,
      nisaType,
      accountLabel,
      quantity,
      avgCostPer10k: parseNumber(cells[idx.avgCost]),
      nav: parseNumber(cells[idx.nav]),
      totalCost: idx.totalCost >= 0 ? parseNumber(cells[idx.totalCost]) : null,
    });
  });

  return { rows, warnings, fatal: null };
}

/** ファイル名（assetbalance(INVST)_20260930_175957.csv）から基準日を取り出す。無ければ null。 */
export function dateFromFileName(fileName: string): string | null {
  const match = fileName.match(/_(\d{4})(\d{2})(\d{2})_/);
  if (!match) return null;
  const [, y, m, d] = match;
  const iso = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}
