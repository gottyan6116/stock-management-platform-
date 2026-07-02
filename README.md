# StockScope

日本株・米国株を横断する長期投資向け個人株価Webアプリ（MVP）。

仕様の最上位ソースは `docs/spec/stockscope_complete_instruction_spec.md`（設計書コピー）。
実装中に仕様と不整合が生じた場合は `docs/adr/` にADRを追加し、無断でスコープを変更しない。

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

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run start` | ビルド結果を起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |
| `npm run test` | Vitest（unit / integration） |
| `npm run e2e` | Playwright E2E |

## ディレクトリ構成

```text
src/app/            App Router（(auth)/login, (dashboard)/favorites|japan|us|stocks/[symbol]|settings, api/）
src/components/     app-shell, charts, search, stocks, tables, freshness, feedback, ui
src/features/       auth, favorites, instruments, markets, prices, sync
src/lib/            market-data(Provider Adapter), aggregation, currency, supabase, validation, errors, utils
src/server/         repositories, services, jobs
src/types/          共有ドメイン型
src/config/         注目銘柄などの設定ファイル
supabase/           migrations, seed.sql, tests
tests/              unit, integration, e2e, visual
docs/adr/           仕様変更の判断記録
```

## 現状（実装フェーズ）

- [x] Phase 0: Repository Setup
- [x] Phase 1: Design Shell（モックデータ、バックエンドなし）
- [x] Phase 2: Auth / DB (Supabase, RLS) — コードは実装済み。Supabaseプロジェクト作成・migration適用はユーザー側作業
- [ ] Phase 3: Provider / Search
- [ ] Phase 4: Favorites
- [ ] Phase 5: Price History / Chart
- [ ] Phase 6: Market Pages
- [ ] Phase 7: Sync (cron / manual)
- [ ] Phase 8: Polish (a11y, perf, E2E, visual regression)

## デプロイについて

このアプリはAPI Routes・Cron・Supabase Auth Callbackを使うため、静的ホスティングのGitHub Pagesでは動作しません
（設計書37章の通りVercel Cronを前提とした設計）。GitHubリポジトリはソース管理のみに使い、デプロイはVercelを利用してください。

## MVPで実装しないもの

株式売買、証券口座連携、板情報、秒/分足、リアルタイムWebSocket、ニュース、AI投資助言、
全上場銘柄の常時同期、保有数量・評価損益、税金計算 など（詳細は設計書 4.2 を参照）。
