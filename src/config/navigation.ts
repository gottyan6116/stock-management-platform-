export type NavIconName =
  | "home"
  | "portfolio"
  | "candidates"
  | "compare"
  | "analysis"
  | "chart"
  | "competitors"
  | "financials"
  | "events"
  | "statements"
  | "performance"
  | "simulation"
  | "favorites"
  | "funds";

type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

type DesktopNavGroup = {
  label: string | null;
  items: readonly NavItem[];
};

export const DESKTOP_NAV_GROUPS: readonly DesktopNavGroup[] = [
  {
    label: null,
    items: [
      { href: "/home", label: "資産成長ホーム", icon: "home" },
      { href: "/portfolio", label: "保有資産", icon: "portfolio" },
      { href: "/favorites", label: "長期保有の候補", icon: "candidates" },
      { href: "/research/compare", label: "比較・ベンチマーク", icon: "compare" },
    ],
  },
  {
    label: "銘柄を調べる",
    items: [
      { href: "/research/analysis", label: "銘柄分析", icon: "analysis" },
      { href: "/research/market", label: "チャート・板・需給", icon: "chart" },
      { href: "/research/competitors", label: "競合比較", icon: "competitors" },
    ],
  },
  {
    label: "企業情報",
    items: [
      { href: "/research/financials", label: "決算・財務", icon: "financials" },
      { href: "/research/events", label: "重要発表・M&A", icon: "events" },
      { href: "/research/statements", label: "経営者・投資家の発言", icon: "statements" },
    ],
  },
  {
    label: "検証",
    items: [
      { href: "/research/performance", label: "予測の成績", icon: "performance" },
      { href: "/simulation", label: "シミュレーション", icon: "simulation" },
    ],
  },
];

export const MOBILE_NAV_ITEMS = [
  { href: "/home", label: "ホーム", icon: "home" },
  { href: "/portfolio", label: "保有資産", icon: "portfolio" },
  { href: "/favorites", label: "候補", icon: "favorites" },
  { href: "/funds", label: "投資信託", icon: "funds" },
  { href: "/simulation", label: "検証", icon: "simulation" },
] as const satisfies readonly NavItem[];
