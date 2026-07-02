# ADR 0001: StockScopeを独立した新規リポジトリとして作成

## 変更対象
実装先のリポジトリ / ディレクトリ構成

## 変更理由
指示書はC:\Users\takas\Desktop\Website（既存の「LP Builder Library」= LPセクション組み立てツール）で受け取ったが、
このリポジトリはStockScopeと無関係な別プロダクトであり、そのまま実装するとNext.jsプロジェクトの構成・依存関係・
ドメインが混在する。

## 代替案
1. Website直下に新規サブフォルダとして追加（同一Gitリポジトリで管理）
2. Website内の既存Next.jsプロジェクトを改造してStockScopeの画面・APIを追加
3. 完全に独立した新規リポジトリを作成（採用）

## 採用案
ユーザーに確認の上、`C:\Users\takas\Desktop\StockScope` に完全新規のNext.jsプロジェクト/Gitリポジトリとして作成した。

## UX・データ・コストへの影響
なし（Website側のLP Builder Libraryには一切変更を加えていない）。

## 後方互換性
影響なし。両リポジトリは完全に独立。

## ロールバック方法
`C:\Users\takas\Desktop\StockScope` ディレクトリを削除するだけで、Website側には何の影響も残らない。
