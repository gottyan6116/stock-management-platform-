import { PageHeader } from "@/components/app-shell/PageHeader";
import { getNavLabel } from "@/config/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 以前はここに固定値の「同期状況」（ダミー）を表示していたが、実データではないため削除した。
  // 想定リターンなどの設定項目は、それを使う機能（候補・検証）と一緒に追加する。
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={getNavLabel("/settings")} />
      <div className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs text-text-muted">ログイン中のアカウント</p>
        <p className="mt-1 text-sm font-semibold text-text-primary">{user?.email ?? "—"}</p>
      </div>
    </div>
  );
}
