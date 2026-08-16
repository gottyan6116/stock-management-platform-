import { describe, expect, it } from "vitest";
import { DESKTOP_NAV_GROUPS, MOBILE_NAV_ITEMS } from "@/config/navigation";

describe("navigation", () => {
  it("starts with the asset-growth home and keeps every href unique", () => {
    const desktopItems = DESKTOP_NAV_GROUPS.flatMap((group) => group.items);
    expect(desktopItems[0]).toMatchObject({ href: "/home", label: "資産成長ホーム" });
    expect(new Set(desktopItems.map((item) => item.href)).size).toBe(desktopItems.length);
  });

  it("keeps mobile navigation to five repeated workflows", () => {
    expect(MOBILE_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/home",
      "/portfolio",
      "/favorites",
      "/funds",
      "/simulation",
    ]);
  });
});
