"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from "@/config/navigation";
import { PRODUCT } from "@/config/product";
import { cn } from "@/lib/utils/cn";
import { UserMenu } from "./UserMenu";

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-button px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active
          ? "bg-primary-soft font-bold text-primary"
          : "font-medium text-text-secondary hover:bg-surface hover:text-text-primary"
      )}
    >
      {item.label}
    </Link>
  );
}

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-border bg-surface-subtle md:flex">
      <div className="px-5 py-5">
        <span className="text-base font-bold text-text-primary">{PRODUCT.name}</span>
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label="メインナビゲーション">
        {MAIN_NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-3 pb-4">
        <SidebarLink item={SETTINGS_NAV_ITEM} pathname={pathname} />
        <UserMenu email={email} />
      </div>
    </aside>
  );
}
