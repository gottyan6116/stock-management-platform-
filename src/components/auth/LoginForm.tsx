"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGE: Record<string, string> = {
  not_allowed: "このメールアドレスは利用が許可されていません。",
  auth_callback_failed: "ログインリンクの検証に失敗しました。もう一度お試しください。",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/favorites";
  const errorCode = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="text-center text-sm text-text-secondary">
        {email} 宛にログインリンクを送信しました。メールを確認してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {errorCode ? (
        <p className="rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger">
          {ERROR_MESSAGE[errorCode] ?? "ログインに失敗しました。"}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger">
          送信に失敗しました。時間をおいて再度お試しください。
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
        className="rounded-button border border-border px-3 py-2 text-sm outline-none focus-visible:border-focus"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {status === "sending" ? "送信中..." : "ログインリンクを送信"}
      </button>
    </form>
  );
}
