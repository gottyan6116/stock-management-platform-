"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeInternalPath } from "@/lib/navigation/internal-path";

const ERROR_MESSAGE: Record<string, string> = {
  not_allowed: "このメールアドレスは利用が許可されていません。",
  auth_callback_failed: "ログインリンクの検証に失敗しました。もう一度お試しください。",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeInternalPath(searchParams.get("redirectTo"));
  const errorCode = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {errorCode ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {ERROR_MESSAGE[errorCode] ?? "ログインに失敗しました。"}
        </p>
      ) : null}
      {status === "error" ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          メールアドレスまたはパスワードが正しくありません。
        </p>
      ) : null}
      <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
        メールアドレス
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-h-11 rounded-button border border-border px-3 py-2 text-sm focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      />
      <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
        パスワード
      </label>
      <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="min-h-11 rounded-button border border-border px-3 py-2 text-sm focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 min-h-11 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {status === "loading" ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
