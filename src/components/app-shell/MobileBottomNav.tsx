"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface md:hidden"
      aria-label="モバイルナビゲーション"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 items-center justify-center px-1 text-center text-xs leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
              active ? "bg-primary-soft font-bold text-primary" : "font-medium text-text-muted hover:text-text-primary"
            )}
          >
            <span className="w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
