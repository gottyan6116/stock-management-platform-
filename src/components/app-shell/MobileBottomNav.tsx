"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Home, PiggyBank, Star, TrendingUp, type LucideIcon } from "lucide-react";
import { MOBILE_NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

const NAV_ICONS: Record<(typeof MOBILE_NAV_ITEMS)[number]["icon"], LucideIcon> = {
  home: Home,
  portfolio: Briefcase,
  simulation: TrendingUp,
  favorites: Star,
  funds: PiggyBank,
};

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden"
      aria-label="モバイルナビゲーション"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
              active ? "bg-primary-soft text-primary" : "text-text-muted hover:text-text-primary"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
