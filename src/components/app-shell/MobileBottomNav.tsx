"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, Landmark, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/favorites", label: "お気に入り", icon: Star },
  { href: "/japan", label: "日本株", icon: Landmark },
  { href: "/us", label: "米国株", icon: Globe2 },
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
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
              active ? "text-primary" : "text-text-muted"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
