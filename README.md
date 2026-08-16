# My portfolio DB

日本株・米国株を横断し、ポートフォリオの収益性と長期的な成長を、根拠・見通し・下振れリスクから判断するための個人投資家向けWebアプリ。

## Release 1の調査データ

Release 1は、ブランド、ナビゲーション、UI/UX基盤のリリースです。現行アプリが提供する保有資産、価格、お気に入り、ファンド、シミュレーションのデータは引き続き利用しますが、調査アウトルック、根拠、スコアはライブ調査ではなく、画面上で「サンプル」と表示するサンプルデータです。

ライブ調査には、Release 2のSupabase構造化調査基盤と、Release 3のCloudflare収集パイプライン（公式または許諾済みソース）の実装が必要です。Release 1のサンプルデータをライブの市場調査や投資助言として使用しないでください。

Release 1の承認済み仕様は
`docs/superpowers/specs/2026-08-16-my-portfolio-db-redesign-design.md`、実装手順は
`docs/superpowers/plans/2026-08-16-my-portfolio-db-release-1.md` を参照してください。
実装中に仕様と不整合が生じた場合は `docs/adr/` にADRを追加し、無断でスコープを変更しません。

## セットアップ

前提: Node.js 20+

```bash
npm install
cp .env.example .env.local   # Supabase等の値を設定
npm run dev                  # http://localhost:3000
```

### Supabaseプロジェクトの準備（Phase 2以降で必須）

現時点では `.env.local` が未設定だとログイン画面を含む全ページがエラーになります（Supabaseクライアントが
URL/Keyを要求するため）。以下の手順で準備してください。

1. https://supabase.com でプロジェクトを作成
2. `supabase/migrations/0001_init.sql` の内容をSupabaseダッシュボードのSQL Editorで実行
   （Supabase CLIがある場合は `supabase link` → `supabase db push` でも可）
3. プロジェクトの Settings > API から取得した値を `.env.local` に設定
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（anon / publishable key）
   - `SUPABASE_SERVICE_ROLE_KEY`（cron・同期処理専用。ブラウザに公開しない）
4. `ALLOWED_EMAILS` に自分のメールアドレスを設定（未設定の場合は誰もログインできません = fail-closed）
5. Authentication > Providers で Email OTP / Magic Link を有効化
6. `npm run dev` を再起動

## スクリプト

| コマンド            | 内容                         |
| ------------------- | ---------------------------- |
| `npm run dev`       | 開発サーバ                   |
| `npm run build`     | 本番ビルド                   |
| `npm run start`     | ビルド結果を起動             |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | tsc --noEmit                 |
| `npm run test`      | Vitest（unit / integration） |
| `npm run e2e`       | Playwright E2E               |

## ディレクトリ構成

```text
src/app/            App Router（login, home, portfolio, favorites, markets, stocks/[symbol], research, settings, api）
src/components/     app-shell, home, portfolio, research, charts, search, stocks, feedback, ui
src/features/       auth, favorites, instruments, markets, portfolio, prices, research, sync
src/lib/            market-data, aggregation, currency, navigation, supabase, validation, errors, utils
src/server/         repositories, services, jobs
src/types/          共有ドメイン型
src/config/         製品、ナビゲーション、調査表示、注目銘柄などの設定ファイル
supabase/           migrations, seed.sql, tests
tests/              unit, integration, e2e, visual
docs/adr/           仕様変更の判断記録
```

## 現状（Release 1）

- [x] Supabase Auth / RLSと既存データワークフロー
- [x] 保有資産、お気に入り、ファンド、市場、シミュレーション、手入力ファンド
- [x] My portfolio DBのブランド、ナビゲーション、ホーム、銘柄詳細、調査UI
- [x] 明示ラベル付きの固定サンプル調査データ
- [ ] Release 2: Supabase構造化調査基盤
- [ ] Release 3: 公式または許諾済みソースの収集パイプライン

## デプロイについて

このアプリはAPI Routes・Cron・Supabase Auth Callbackを使うため、静的ホスティングのGitHub Pagesでは動作しません
（Vercel Cronを前提とした設計）。GitHubリポジトリはソース管理のみに使い、デプロイはVercelを利用してください。

## Release 1で実装しないもの

株式売買、証券口座連携、ライブ板・需給、秒/分足、リアルタイムWebSocket、ライブニュース、
ライブ調査・AI投資助言、全上場銘柄の常時同期、税金計算。保有数量、通貨別評価額、評価損益は既存機能として引き続き利用できます。
