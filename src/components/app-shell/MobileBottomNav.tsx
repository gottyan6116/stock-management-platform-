"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Globe2, Landmark, PiggyBank, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/portfolio", label: "ポートフォリオ", icon: Briefcase },
  { href: "/favorites", label: "お気に入り", icon: Star },
  { href: "/japan", label: "日本株", icon: Landmark },
  { href: "/us", label: "米国株", icon: Globe2 },
  { href: "/funds", label: "投資信託", icon: PiggyBank },
  { href: "/simulation", label: "シミュレーション", icon: TrendingUp },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden"
      aria-label="モバイルナビゲーション"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] font-medium leading-tight",
              active ? "text-primary" : "text-text-muted"
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
