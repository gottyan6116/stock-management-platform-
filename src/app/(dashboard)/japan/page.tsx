import { redirect } from "next/navigation";

// このページは日経平均・ドル円などの固定サンプル値（モック）を実データのように表示しており、
// 他画面の価格と食い違っていた（Phase 0-1）。実データに接続されるまで表示せず、お気に入りへ誘導する。
export default function JapanPage() {
  redirect("/favorites");
}
