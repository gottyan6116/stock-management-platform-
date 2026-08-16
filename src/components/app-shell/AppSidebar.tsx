"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ChartCandlestick,
  Home,
  Landmark,
  LineChart,
  MessageSquare,
  PiggyBank,
  Scale,
  Search,
  Star,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { DESKTOP_NAV_GROUPS, type NavIconName } from "@/config/navigation";
import { PRODUCT } from "@/config/product";
import { cn } from "@/lib/utils/cn";
import { UserMenu } from "./UserMenu";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  home: Home,
  portfolio: Briefcase,
  candidates: Star,
  compare: Scale,
  analysis: Search,
  chart: ChartCandlestick,
  competitors: UsersRound,
  financials: Landmark,
  events: CalendarDays,
  statements: MessageSquare,
  performance: BarChart3,
  simulation: TrendingUp,
  favorites: Star,
  funds: PiggyBank,
};

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <LineChart className="h-6 w-6 text-primary" aria-hidden />
        <span className="text-lg font-bold text-text-primary">{PRODUCT.name}</span>
      </div>

      <nav
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4"
        aria-label="メインナビゲーション"
      >
        {DESKTOP_NAV_GROUPS.map((group, groupIndex) => (
          <section
            key={group.label ?? `primary-${groupIndex}`}
            className="rounded-sm bg-primary-soft p-2"
          >
            {group.label ? (
              <h2 className="px-2 pb-1.5 pt-1 text-xs font-semibold text-text-secondary">
                {group.label}
              </h2>
            ) : null}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                      active
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:bg-surface hover:text-text-primary"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <UserMenu email={email} />
      </div>
    </aside>
  );
}
