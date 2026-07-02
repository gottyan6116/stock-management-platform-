import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { MobileBottomNav } from "@/components/app-shell/MobileBottomNav";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middlewareが未認証を/loginへリダイレクトするため、ここに到達する場合は通常user必須。
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar email={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
