import { Suspense } from "react";
import { LineChart } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-card">
        <div className="mb-6 flex items-center justify-center gap-2">
          <LineChart className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-lg font-bold text-text-primary">StockScope</span>
        </div>
        <p className="mb-6 text-center text-sm text-text-secondary">
          登録済みのメールアドレスとパスワードでログインしてください
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
