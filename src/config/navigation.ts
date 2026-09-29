export type NavIconName = "home" | "portfolio" | "candidates" | "settings";

export type NavItem = {
  href: string;
  /** ナビ名。ページタイトル(h1)と必ず一致させる。 */
  label: string;
  icon: NavIconName;
};

// サイドバーは「ホーム／保有資産／候補・検証」の3項目＋下部の「設定」（Phase 1）。
export const MAIN_NAV_ITEMS: readonly NavItem[] = [
  { href: "/home", label: "ホーム", icon: "home" },
  { href: "/portfolio", label: "保有資産", icon: "portfolio" },
  { href: "/candidates", label: "候補・検証", icon: "candidates" },
];

export const SETTINGS_NAV_ITEM: NavItem = { href: "/settings", label: "設定", icon: "settings" };

export const MOBILE_NAV_ITEMS: readonly NavItem[] = [...MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM];

/**
 * ナビから外した画面の旧URL。ルート（ファイル）は残したまま、next.config.mjs で
 * 移行先へリダイレクトする（ブックマークや内部リンクが壊れないように）。
 */
export const LEGACY_ROUTE_REDIRECTS: readonly { source: string; destination: string }[] = [
  { source: "/favorites", destination: "/candidates" },
  { source: "/funds", destination: "/portfolio" },
  { source: "/simulation", destination: "/candidates" },
  { source: "/japan", destination: "/candidates" },
  { source: "/us", destination: "/candidates" },
  { source: "/research/:section*", destination: "/candidates" },
];

/** ページタイトル(h1)はナビ名と一致させる。ページ側はこの関数でナビ設定から取得する。 */
export function getNavLabel(href: NavItem["href"]): string {
  const item = [...MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM].find((i) => i.href === href);
  if (!item) throw new Error(`no nav item for ${href}`);
  return item.label;
}
