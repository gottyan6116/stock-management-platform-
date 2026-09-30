import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_ROUTE_REDIRECTS,
  MAIN_NAV_ITEMS,
  MOBILE_NAV_ITEMS,
  SETTINGS_NAV_ITEM,
} from "@/config/navigation";

describe("navigation (Phase 1: サイドバーは4項目)", () => {
  it("has exactly home / portfolio / candidates plus settings at the bottom", () => {
    expect(MAIN_NAV_ITEMS.map((i) => [i.href, i.label])).toEqual([
      ["/home", "ホーム"],
      ["/portfolio", "保有資産"],
      ["/candidates", "候補・検証"],
    ]);
    expect(SETTINGS_NAV_ITEM).toMatchObject({ href: "/settings", label: "設定" });
  });

  it("keeps every href unique", () => {
    const hrefs = [...MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM].map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("uses the same four destinations on mobile", () => {
    expect(MOBILE_NAV_ITEMS.map((i) => i.href)).toEqual(["/home", "/portfolio", "/candidates", "/settings"]);
  });

  it("redirects every removed screen instead of deleting its route", () => {
    const sources = LEGACY_ROUTE_REDIRECTS.map((r) => r.source);
    for (const removed of ["/favorites", "/funds", "/simulation", "/japan", "/us", "/research/:section*"]) {
      expect(sources).toContain(removed);
    }
    // 移行先は必ず存続するルート
    const alive = new Set(["/portfolio", "/candidates"]);
    for (const r of LEGACY_ROUTE_REDIRECTS) expect(alive.has(r.destination)).toBe(true);
  });

  it("keeps next.config.mjs in sync with LEGACY_ROUTE_REDIRECTS", () => {
    const config = readFileSync("next.config.mjs", "utf8");
    for (const r of LEGACY_ROUTE_REDIRECTS) {
      expect(config).toContain(`source: "${r.source}", destination: "${r.destination}"`);
    }
  });
});
