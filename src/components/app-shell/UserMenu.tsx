"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-sm px-2 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
        <UserRound className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{email}</span>
      <Link
        href="/settings"
        aria-label="設定"
        className="rounded-sm p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="ログアウト"
        className="rounded-sm p-1.5 text-text-muted hover:bg-surface-subtle hover:text-danger"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
