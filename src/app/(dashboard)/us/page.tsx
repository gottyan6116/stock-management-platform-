import { redirect } from "next/navigation";

// /japan と同じ理由（モックの指数・銘柄価格を表示していた）で、お気に入りへリダイレクトする。
export default function UsPage() {
  redirect("/favorites");
}
