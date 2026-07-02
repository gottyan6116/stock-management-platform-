# StockScope

株式・在庫管理プラットフォーム（開発初期）。仕様書ベースで実装を進める。

## スタック
- Next.js / React / TypeScript / npm / Supabase
- テスト: Vitest（unit）+ Playwright（e2e）

## コマンド
- 開発サーバー: `npm run dev -- -p 3006`（launch.json の "stockscope"）
- 型チェック: `npm run typecheck` ／ Lint: `npm run lint` ／ 整形: `npm run format`
- テスト: `npm run test`（unit）, `npm run e2e`

## 仕様・ドキュメント
- 完全仕様書: `docs/spec/stockscope_complete_instruction_spec.md`（実装はこれに従う）
- 設計判断は `docs/adr/` に記録

## 環境変数
- `.env.local` は git 管理外（`.env.example` を雛形として使う）。中身を読んだり出力したりしない。

## リポジトリ
- `gottyan6116/stock-management-platform-`
