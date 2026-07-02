"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, Landmark, LineChart, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UserMenu } from "./UserMenu";

const NAV_ITEMS = [
  { href: "/favorites", label: "お気に入り銘柄", icon: Star },
  { href: "/japan", label: "日本株", icon: Landmark },
  { href: "/us", label: "米国株", icon: Globe2 },
] as const;

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <LineChart className="h-6 w-6 text-primary" aria-hidden />
        <span className="text-lg font-bold text-text-primary">StockScope</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="メインナビゲーション">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <UserMenu email={email} />
      </div>
    </aside>
  );
}
