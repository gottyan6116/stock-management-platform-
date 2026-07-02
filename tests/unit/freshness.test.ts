import { describe, expect, it } from "vitest";
import { computeFreshnessStatus } from "@/lib/utils/freshness";

describe("computeFreshnessStatus", () => {
  const now = new Date("2026-07-01T09:00:00Z");

  it("同期失敗フラグがあればfailedを返す", () => {
    expect(
      computeFreshnessStatus({
        priceDate: "2026-06-30",
        fetchedAt: "2026-07-01T00:00:00Z",
        syncFailed: true,
        now,
      })
    ).toBe("failed");
  });

  it("priceDateやfetchedAtが無ければunknownを返す", () => {
    expect(computeFreshnessStatus({ priceDate: null, fetchedAt: null, now })).toBe("unknown");
  });

  it("24時間以内の取得ならokを返す", () => {
    expect(
      computeFreshnessStatus({
        priceDate: "2026-06-30",
        fetchedAt: "2026-07-01T00:00:00Z",
        now,
      })
    ).toBe("ok");
  });

  it("24時間より古い取得ならstaleを返す", () => {
    expect(
      computeFreshnessStatus({
        priceDate: "2026-06-28",
        fetchedAt: "2026-06-29T00:00:00Z",
        now,
      })
    ).toBe("stale");
  });
});
