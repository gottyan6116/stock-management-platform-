import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDateTime,
  formatDateTimeCompact,
  formatPrice,
  todayJst,
} from "@/lib/utils/format";

describe("formatCurrency (0-4: 円は整数表示)", () => {
  it("shows yen amounts without decimals", () => {
    expect(formatCurrency(3576643.4, "JPY")).toBe("¥3,576,643");
    expect(formatCurrency(10000000, "JPY")).toBe("¥10,000,000");
    expect(formatCurrency(1029644.376, "JPY")).toBe("¥1,029,644");
  });

  it("keeps two decimals for USD", () => {
    expect(formatCurrency(87.49, "USD")).toBe("$87.49");
    expect(formatCurrency(-20.17, "USD")).toBe("$-20.17");
  });

  it("returns an em dash for missing values", () => {
    expect(formatCurrency(null, "JPY")).toBe("—");
  });
});

describe("formatPrice (株価は通貨の慣習に従う)", () => {
  it("shows whole-yen prices without a trailing .0 and keeps a real tenth of a yen", () => {
    expect(formatPrice(171, "JPY")).toBe("¥171");
    expect(formatPrice(171.0, "JPY")).toBe("¥171");
    expect(formatPrice(240.7, "JPY")).toBe("¥240.7");
    expect(formatPrice(38532, "JPY")).toBe("¥38,532");
  });

  it("shows USD prices with two decimals", () => {
    expect(formatPrice(123.7, "USD")).toBe("$123.70");
  });
});

describe("formatDateTime (0-5: すべてJSTで表示しJSTを明記)", () => {
  it("renders a UTC instant in Japan time with the JST label, independent of the machine's time zone", () => {
    // 03:04 UTC == 12:04 JST. The old implementation printed 03:04 when rendered on the (UTC) server.
    expect(formatDateTime("2026-09-29T03:04:00Z")).toBe("2026-09-29 12:04 JST");
  });

  it("rolls the date over when the UTC time is late in the day", () => {
    expect(formatDateTime("2026-09-28T16:30:00Z")).toBe("2026-09-29 01:30 JST");
  });

  it("does not show 24:xx at midnight JST", () => {
    expect(formatDateTime("2026-09-28T15:05:00Z")).toBe("2026-09-29 00:05 JST");
  });

  it("returns an em dash for missing values", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("offers a compact month/day form for narrow screens", () => {
    expect(formatDateTimeCompact("2026-09-29T03:04:00Z")).toBe("09/29 12:04");
  });
});

describe("todayJst", () => {
  it("returns the Japan calendar date even when it is still the previous day in UTC", () => {
    expect(todayJst(new Date("2026-09-28T16:30:00Z"))).toBe("2026-09-29");
    expect(todayJst(new Date("2026-09-29T03:04:00Z"))).toBe("2026-09-29");
  });
});
