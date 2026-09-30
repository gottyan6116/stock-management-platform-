import { PageHeader } from "@/components/app-shell/PageHeader";
import { BenchmarkSettingsForm } from "@/components/settings/BenchmarkSettingsForm";
import { getNavLabel } from "@/config/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 以前はここに固定値の「同期状況」（ダミー）を表示していたが、実データではないため削除した。
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={getNavLabel("/settings")} />
      <div className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs text-text-muted">ログイン中のアカウント</p>
        <p className="mt-1 text-sm font-semibold text-text-primary">{user?.email ?? "—"}</p>
      </div>
      <BenchmarkSettingsForm />
    </div>
  );
}
