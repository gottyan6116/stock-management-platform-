"use client";

import { LogOut } from "lucide-react";
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
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-text-muted" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="ログアウト"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-text-muted hover:bg-surface hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
