# StockScope 完全指示設計書
## 日本株・米国株を横断する長期投資向け個人株価Webアプリ

- 文書バージョン: 1.0
- 作成日: 2026-07-01
- 対象: Cursor / Codex / Claude Code / その他の実装AIエージェント
- 想定利用者: 個人投資家1名
- 仮プロダクト名: StockScope
- 優先デバイス: デスクトップ
- 対応デバイス: タブレット・スマートフォン
- 主要市場: 日本株・米国株
- 投資スタイル: 長期保有
- 価格更新: 日次
- 主要チャート: 週足・月足

---

# 0. この指示書の使い方

この文書を、実装AIエージェントへの最上位仕様として扱うこと。

実装AIは、勝手に機能・画面・ナビゲーション項目を増やしてはならない。曖昧な点がある場合は、この文書内の「優先順位」「非機能要件」「UX原則」「MVP範囲」を根拠に、最小かつ保守可能な実装を選ぶこと。

実装中に仕様変更が必要になった場合は、コードを先に変更せず、以下を記載したADRを `/docs/adr/` に追加すること。

1. 変更対象
2. 変更理由
3. 代替案
4. 採用案
5. UX・データ・コストへの影響
6. 後方互換性
7. ロールバック方法

---

# 1. 実装AIへの最上位命令

あなたは、プロダクトデザイナー、シニアフロントエンドエンジニア、バックエンドエンジニア、データエンジニア、QAエンジニアの役割を兼務する。

目的は、楽天証券iSPEEDの情報過多・視認性の低さを解消し、日本株と米国株を1つの画面体系で確認できる、個人利用の長期投資向けWebアプリを完成させることである。

単に参考画像をHTMLで再現するのではなく、以下を同時に満たすこと。

- SaaSらしいシンプルでモダンなUI
- 日本株と米国株を横断する統一UX
- 日次更新を前提とした正直な鮮度表示
- 週足・月足を中心とした長期投資向けチャート
- 検索からお気に入り追加までの短い導線
- Yahoo Finance依存を交換可能にするProvider設計
- 個人データを公開しない認証・RLS設計
- 無料または低コストで維持できる構成
- エラー時にもデータ鮮度と障害箇所が分かる運用性
- テスト可能で、将来APIを差し替えられるコード品質

---

# 2. プロダクトの目的

## 2.1 解決する課題

既存証券アプリは、短期売買、注文、ニュース、ランキング、板情報などが同一画面に混在し、長期保有者が日常的に確認したい情報へ到達しにくい。

本プロダクトは、次の問いに短時間で答えられることを目的とする。

- 自分が注目している日本株・米国株は、長期でどのように推移しているか
- 週足・月足で上昇・下落トレンドはどう見えるか
- 日本株と米国株を同じ操作体系で確認できるか
- 前営業日終値ベースで、どの銘柄がどの程度変動したか
- 気になる銘柄を検索し、すぐお気に入りへ追加できるか
- 円建てと現地通貨建てを混同せず確認できるか
- データがいつの時点のものか明確か

## 2.2 プロダクト価値

「取引するための画面」ではなく、「長期保有銘柄を落ち着いて観察するための画面」を提供する。

## 2.3 成功指標

MVPではアクセス解析より、以下のプロダクト品質を優先する。

- 初回表示から3秒以内に主要UIが視認できる
- 銘柄検索からお気に入り追加まで3アクション以内
- 日本株・米国株ページの切り替えが1アクション
- 週足・月足切り替えが1アクション
- すべての価格にデータ基準日を表示
- お気に入り追加・削除の成功率99%以上
- 日次同期処理が冪等
- 同期失敗時に前回正常データを表示し続ける
- モバイルでも主要情報が横スクロール地獄にならない

---

# 3. 対象ユーザー

## 3.1 プライマリユーザー

- 個人投資家1名
- 日本株と米国株を保有または監視
- デイトレードをしない
- 週足・月足で中長期トレンドを確認
- 数秒単位のリアルタイム性を必要としない
- UIの見やすさを重視
- PCを中心に、スマートフォンでも確認する可能性がある

## 3.2 Jobs To Be Done

### Job 1
アプリを開いたとき、注目銘柄全体の状態を短時間で把握したい。

### Job 2
日本株と米国株を、別サービスへ移動せず同じUIで確認したい。

### Job 3
銘柄名またはティッカーを検索し、気になる銘柄をお気に入りへ保存したい。

### Job 4
日々のノイズではなく、週足・月足の長期推移を確認したい。

### Job 5
表示価格がリアルタイムなのか、前営業日終値なのかを誤解したくない。

---

# 4. スコープ定義

## 4.1 MVP必須機能

- ログイン
- 左サイドバー
  - お気に入り銘柄
  - 日本株
  - 米国株
- 全ページ共通検索
- 日本株・米国株の銘柄検索
- お気に入り追加・解除
- お気に入り一覧
- 日本株ページ
- 米国株ページ
- 銘柄詳細ページ
- 週足チャート
- 月足チャート
- 期間切り替え
  - 1年
  - 3年
  - 5年
  - 10年
  - 全期間
- 前営業日比
- 最終データ基準日
- 最終取得日時
- 日次自動同期
- 手動同期
- 同期履歴
- エラー・空状態・ローディング状態
- レスポンシブ対応
- テスト
- README
- 環境変数サンプル

## 4.2 MVPでは実装しないもの

- 株式売買注文
- 証券口座連携
- 板情報
- ティックデータ
- 秒・分足
- リアルタイムWebSocket
- 自動売買
- 信用取引
- オプション取引
- SNS機能
- 他ユーザーとの共有
- ニュースフィード
- AI投資助言
- 売買推奨
- 高度なスクリーナー
- 全上場銘柄の常時ローカル保存
- 証券会社残高の自動取得
- 保有数量・取得単価・評価損益
- 配当実績の厳密計算
- 税金計算

## 4.3 Phase 2候補

- 保有数量・平均取得単価の手入力
- 評価額・含み損益
- 円建て評価
- 取引履歴
- 実現損益
- 配当履歴
- 年間配当予想
- セクター配分
- ベンチマーク比較
- CSVインポート・エクスポート
- リバランス分析

---

# 5. 重要な前提修正

参考UI画像には「評価額合計」「評価損益」「保有数」「年間配当」が表示されているが、これらを正確に表示するには、保有数量・取得単価・取引履歴が必要である。

MVPでは保有情報を扱わないため、架空の評価額を表示してはならない。

## 5.1 MVPのサマリーカード

お気に入りページでは以下を表示する。

1. お気に入り銘柄数
2. 1年騰落率の単純平均
3. 日本株 / 米国株の銘柄数比率
4. 取得可能な銘柄のみを対象にした平均配当利回り

## 5.2 Phase 2移行後

保有情報が1件以上登録された場合のみ、以下へ切り替え可能とする。

- 評価額合計
- 評価損益合計
- 日本株 / 米国株の評価額比率
- 年間配当予想

## 5.3 表示禁止

保有情報がない状態で、0円やサンプル金額を本番UIに表示してはならない。

---

# 6. UX原則

## 6.1 長期投資ファースト

初期表示は週足または月足とする。日足は詳細画面の補助選択肢としてもMVPでは不要。

## 6.2 鮮度を誤認させない

以下の文言を使用する。

- 「現在値」ではなく「最新終値」
- 「本日の騰落」ではなく「前営業日比」
- 「最終更新」だけでなく「価格基準日」を表示

例:

- 価格基準日: 2026-06-30
- 取得日時: 2026-07-01 08:42 JST
- データ種別: 日次終値

## 6.3 1画面1目的

- お気に入り: 横断確認
- 日本株: 日本市場と日本株の探索
- 米国株: 米国市場と米国株の探索
- 銘柄詳細: 1銘柄の深掘り

## 6.4 情報密度を抑える

- KPIカードは最大4枚
- メインチャートは1つ
- サイドカードは最大1つ
- 表の初期表示列は最大8列
- 詳細指標は銘柄詳細へ移す
- 小さい画面では列を削減する

## 6.5 検索導線を統一

全ページ上部に同じ検索ボックスを置く。検索UI、検索結果、追加操作をページごとに変えない。

## 6.6 色だけで意味を伝えない

上昇・下落は色に加えて、プラス・マイナス符号とアイコンを表示する。

## 6.7 操作の取り消しを可能にする

お気に入り解除後、5秒間「元に戻す」を表示する。

---

# 7. 情報設計

## 7.1 左サイドバー

表示項目は以下の3つのみとする。

1. お気に入り銘柄
2. 日本株
3. 米国株

ナビゲーション項目を勝手に追加してはならない。

サイドバー下部には以下のみ配置可能。

- ユーザーアバター
- ユーザー名またはメール
- 設定ボタン
- ログアウト

## 7.2 ルート

```text
/
  -> /favorites へリダイレクト

/login
/favorites
/japan
/us
/stocks/[symbol]
/settings

/api/search
/api/favorites
/api/favorites/[instrumentId]
/api/markets/japan
/api/markets/us
/api/stocks/[symbol]
/api/stocks/[symbol]/chart
/api/sync/manual
/api/cron/daily-sync
/api/health
```

## 7.3 ページ階層

```text
App Shell
├── Sidebar
├── Header
│   ├── Page Title
│   ├── Global Search
│   └── Freshness Status
└── Page Content
    ├── Summary Cards
    ├── Main Chart
    ├── Side Information Card
    └── Stock Table
```

---

# 8. デザインシステム

## 8.1 デザイン方向

- SaaSらしい
- シンプル
- モダン
- 白基調
- 薄いグレー背景
- ネイビーとブルーを主アクセント
- 強すぎるグラスモーフィズムは禁止
- 過剰なグラデーションは禁止
- 強いドロップシャドウは禁止
- 金融アプリ特有の黒背景・ネオン表現は禁止
- デイトレーダー向けターミナル風UIは禁止

## 8.2 カラートークン

```css
:root {
  --background: #f7f9fc;
  --surface: #ffffff;
  --surface-subtle: #f8fafc;

  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;

  --border: #e2e8f0;
  --border-strong: #cbd5e1;

  --primary: #155eef;
  --primary-hover: #0b4dd8;
  --primary-soft: #eaf2ff;

  --success: #15803d;
  --success-soft: #ecfdf3;

  --danger: #dc2626;
  --danger-soft: #fef2f2;

  --warning: #d97706;
  --warning-soft: #fffbeb;

  --focus: #2563eb;
}
```

## 8.3 タイポグラフィ

- UIフォント: `Inter`, `Noto Sans JP`, system-ui, sans-serif
- 明朝体は禁止
- 数字はtabular-numsを使用
- ページタイトル: 30px / 700
- セクションタイトル: 18px / 700
- カードラベル: 13px / 600
- KPI数値: 26–30px / 700
- 本文: 14px / 400
- 補足: 12px / 400
- 表ヘッダー: 12px / 600
- 表本文: 13–14px / 500

## 8.4 スペーシング

8pxグリッドを基本とする。

```text
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48
```

## 8.5 角丸

```text
小要素: 8px
ボタン: 10px
カード: 14px
大型カード: 16px
モーダル: 18px
```

## 8.6 シャドウ

```css
box-shadow:
  0 1px 2px rgba(15, 23, 42, 0.04),
  0 6px 20px rgba(15, 23, 42, 0.05);
```

## 8.7 枠線

カードは原則として1pxの薄い境界線を持たせる。

```css
border: 1px solid var(--border);
```

## 8.8 アイコン

- `lucide-react`を使用
- サイズは16 / 18 / 20 / 24
- 同一意味で異なるアイコンを混在させない
- 企業ロゴはMVP必須ではない
- 外部サイトから企業ロゴを無断スクレイピングしない
- ロゴがない場合はティッカー頭文字のモノグラムを使用

---

# 9. レイアウト仕様

## 9.1 デスクトップ

- 基準幅: 1440px
- サイドバー: 240px
- サイドバー縮小時: 72px
- メインコンテンツ最大幅: 1600px
- ページ左右余白: 32px
- 上下余白: 24px
- KPIカード: 4カラム
- チャート領域: 2カラム
  - メイン 2/3
  - サイド 1/3

## 9.2 タブレット

- 768–1023px
- サイドバーはアイコンのみ、またはドロワー
- KPIカードは2カラム
- チャートは縦積み
- 表は重要列のみ

## 9.3 スマートフォン

- 767px以下
- 左サイドバーを非表示
- 画面下部に3タブのボトムナビゲーション
  - お気に入り
  - 日本株
  - 米国株
- KPIカードは横スクロールではなく2列または1列
- メインチャートは横幅100%
- 表はカードリストへ変換
- 検索はヘッダーの検索アイコンから全画面シートを開く
- 銘柄名、最新終値、前営業日比、ミニチャート、お気に入り操作を表示

---

# 10. App Shell

## 10.1 Sidebar

### 上部

- 仮ロゴ
- `StockScope`
- 折りたたみボタン

### メニュー

```text
Star       お気に入り銘柄
Landmark   日本株
Globe2     米国株
```

### 選択状態

- 背景: primary-soft
- アイコン・文字: primary
- 左端に過剰な太線は付けない
- hoverとactiveを明確に分ける

## 10.2 Header

各ページ上部に以下を置く。

- 左: ページタイトル
- 中央または右: グローバル検索
- 右端: 鮮度ステータス

鮮度表示例:

```text
● 正常
価格基準日 2026-06-30
取得 2026-07-01 08:42
```

ステータス:

- 緑: 正常
- 黄: 24時間以上古い
- 赤: 同期失敗
- グレー: 未取得

---

# 11. グローバル検索UX

## 11.1 検索対象

- 日本株
- 米国株
- ETF
- 主要指数

MVPでは暗号資産、FX、投資信託、先物、オプションを検索結果から除外する。

## 11.2 入力

- プレースホルダー: `銘柄名・コード・ティッカーで検索`
- 2文字未満では外部検索を行わない
- 350msデバウンス
- Enterで先頭結果の詳細ページへ遷移
- Escで閉じる
- 上下キーで候補移動
- `/`キーで検索フォーカス

## 11.3 検索順序

1. ローカルDBのinstrument検索
2. ローカルに結果が少ない場合のみProvider検索
3. 取得結果を正規化
4. 対応市場のみ表示
5. 重複排除

## 11.4 検索結果表示

市場別にグルーピングする。

```text
日本株
トヨタ自動車
7203 / 7203.T
東京証券取引所
JPY

米国株
Apple Inc.
AAPL
NASDAQ
USD
```

各結果に以下を表示。

- 銘柄名
- 表示ティッカー
- 取引所
- 通貨
- 市場バッジ
- お気に入り状態
- 「詳細を見る」
- 「お気に入りに追加」

## 11.5 検索エラー

- 0件: 検索条件を変える案内
- Provider障害: ローカル検索結果だけ表示し、障害を明示
- タイムアウト: 再試行ボタン
- 無効な銘柄: 追加不可

---

# 12. お気に入り追加・解除UX

## 12.1 追加

- 星アイコンをクリック
- 即座に選択状態へ変更
- optimistic update
- 成功時: `お気に入りに追加しました`
- 初回追加時は過去データ同期を開始
- データ同期中でもお気に入り登録自体は完了扱い
- チャート部分は同期中スケルトンを表示

## 12.2 重複

同一ユーザー・同一instrumentの重複登録をDB制約で防止する。

## 12.3 解除

- 星アイコンをクリック
- 即座に一覧から除外
- 5秒間Undoトースト
- Undo時は復元
- 解除しても価格履歴は即削除しない

## 12.4 削除確認

お気に入り解除に確認モーダルは使用しない。Undoで対応する。

---

# 13. お気に入り銘柄ページ

ルート: `/favorites`

## 13.1 目的

日本株・米国株を横断して、注目銘柄の長期状態を確認する。

## 13.2 ページ構成

1. Header
2. KPIカード4枚
3. お気に入りバスケット推移チャート
4. 日本株 / 米国株比率
5. お気に入り一覧
6. 空状態

## 13.3 KPIカード

### カード1: お気に入り銘柄数

```text
お気に入り銘柄
12銘柄
日本 5 / 米国 7
```

### カード2: 1年騰落率平均

- 調整後終値を使用
- 1年前にデータがない銘柄は除外
- 対象銘柄数をツールチップで表示
- 単純平均であることを明示

### カード3: 市場比率

- 銘柄数ベース
- 日本株 / 米国株
- 保有額比率ではない

### カード4: 平均配当利回り

- 配当利回り取得可能銘柄のみ
- 欠損を0として扱わない
- 対象件数を表示

## 13.4 お気に入りバスケット推移

保有額がないため、評価額推移を表示してはならない。

代わりに、各銘柄の調整後終値を期間開始時点100として正規化し、等ウェイト平均した「お気に入り指数」を表示する。

```text
各銘柄 normalized = currentAdjustedClose / firstAdjustedClose * 100
basket = valid normalized values の単純平均
```

表示名:

`お気に入り銘柄の長期推移（開始時点=100）`

比較対象を任意で1つ追加可能。

- 日経平均
- S&P 500

## 13.5 市場比率

CSS `conic-gradient`またはSVGで作成する。

- 日本株: 薄いブルー
- 米国株: 濃いブルー
- 比率は銘柄数
- 合計銘柄数を中央表示

## 13.6 一覧テーブル

初期列:

1. 銘柄
2. 市場
3. 最新終値
4. 前営業日比
5. 1年騰落率
6. ミニチャート
7. 配当利回り
8. 操作

オプション列:

- PER
- 時価総額
- 通貨
- 価格基準日

### 行クリック

銘柄詳細へ遷移する。

### 並び替え

- 銘柄名
- 前営業日比
- 1年騰落率
- 配当利回り
- お気に入り追加日

### フィルター

- すべて
- 日本株
- 米国株

## 13.7 空状態

```text
まだお気に入り銘柄がありません
銘柄名・コード・ティッカーで検索して追加してください
[銘柄を検索]
```

装飾イラストは小さく、画面の主役にしない。

---

# 14. 日本株ページ

ルート: `/japan`

## 14.1 目的

日本市場の長期状況と、日本株のお気に入り・注目銘柄を確認する。

## 14.2 ページ構成

1. Header
2. KPIカード
3. 日経平均長期チャート
4. 日本市場概要
5. 日本株のお気に入り・注目銘柄一覧

## 14.3 KPIカード

1. 日経平均 最新終値
2. 日経平均 前営業日比
3. 日本株お気に入り数
4. 日本株お気に入りの1年騰落率平均

取得できない指標を無理に表示しない。

## 14.4 メインチャート

初期対象: 日経平均

- 週足初期表示
- 月足切り替え
- 期間:
  - 1年
  - 3年
  - 5年
  - 10年
  - 全期間
- ローソク足 / ライン切り替え
- 初期はローソク足
- 出来高は表示可能な場合のみ
- ツールチップ:
  - 期間
  - 始値
  - 高値
  - 安値
  - 終値
  - 前期間比

## 14.5 日本市場概要

表示候補:

- 日経平均
- TOPIXまたは設定済みの代替指標
- ドル円
- 価格基準日
- 取得日時

Providerで安定取得できない指標は非表示とし、架空値・固定値を表示しない。

## 14.6 日本株一覧

見出しは `日本株一覧` ではなく、以下のどちらかとする。

- `日本株のお気に入り`
- `日本株の注目銘柄`

「東証全銘柄を保持している」と誤認させる表現は禁止。

初期表示:

- 日本株のお気に入り
- お気に入りが少ない場合は設定ファイルの注目銘柄を追加表示
- 注目銘柄はお気に入りと明確に区別

サンプル注目銘柄:

- 7203.T
- 8306.T
- 9984.T
- 8035.T
- 7974.T

サンプルは設定ファイルに分離し、本番データとしてハードコードしない。

---

# 15. 米国株ページ

ルート: `/us`

## 15.1 目的

米国市場の長期状況と、米国株のお気に入り・注目銘柄を確認する。

## 15.2 ページ構成

1. Header
2. KPIカード
3. S&P 500長期チャート
4. 米国市場概要
5. 米国株のお気に入り・注目銘柄一覧

## 15.3 KPIカード

1. S&P 500 最新終値
2. S&P 500 前営業日比
3. 米国株お気に入り数
4. 米国株お気に入りの1年騰落率平均

## 15.4 メインチャート

初期対象: S&P 500

切り替え候補:

- S&P 500
- NASDAQ Composite

足種・期間・表示方式は日本株ページと完全に統一する。

## 15.5 米国市場概要

- S&P 500
- NASDAQ Composite
- USD/JPY
- 価格基準日
- 取得日時

## 15.6 米国株一覧

サンプル注目銘柄:

- AAPL
- NVDA
- MSFT
- AMZN
- GOOGL

列、ソート、フィルター、ミニチャート、詳細遷移は日本株ページと統一する。

## 15.7 通貨表示

米国株の価格は初期状態でUSD表示とする。

オプションとしてJPY換算表示を選べるが、以下を必ず明記する。

- 使用為替レート
- 為替基準日
- 概算値
- 証券会社評価額と一致しない可能性

---

# 16. 銘柄詳細ページ

ルート: `/stocks/[symbol]`

サイドバー項目には追加しない。

## 16.1 Header

- 戻る
- 銘柄名
- ティッカー
- 市場
- 通貨
- お気に入りボタン
- 価格基準日

## 16.2 KPI

最大4枚。

- 最新終値
- 前営業日比
- 1年騰落率
- 配当利回りまたは時価総額

欠損データは `—` とし、0を表示しない。

## 16.3 チャート

- 週足 / 月足
- 1年 / 3年 / 5年 / 10年 / 全期間
- ローソク足 / ライン
- adjusted closeを使う比較ライン
- raw OHLCを使うローソク足
- crosshair
- tooltip
- fit content
- ResizeObserver対応
- 初回表示でチャートが潰れないこと

## 16.4 指標

取得可能なものだけ表示。

- PER
- PBR
- 配当利回り
- 時価総額
- 52週高値
- 52週安値
- 通貨
- 取引所
- セクター
- 業種

データ取得不能をエラーとしてページ全体に波及させない。

---

# 17. データソース戦略

## 17.1 MVP Provider

MVPでは `yahoo-finance2`を使用する。

ただし、外部Providerの型をUI・DBへ直接露出させてはならない。

## 17.2 Provider Interface

```ts
export type Market = "JP" | "US";
export type Currency = "JPY" | "USD";
export type InstrumentType = "stock" | "etf" | "index";

export interface InstrumentSearchResult {
  providerSymbol: string;
  displaySymbol: string;
  name: string;
  exchange: string | null;
  market: Market;
  currency: Currency;
  instrumentType: InstrumentType;
}

export interface QuoteSnapshot {
  providerSymbol: string;
  priceDate: string;
  fetchedAt: string;
  currency: Currency;
  close: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
}

export interface DailyPrice {
  providerSymbol: string;
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjustedClose: number | null;
  volume: number | null;
}

export interface MarketDataProvider {
  search(query: string, market?: Market): Promise<InstrumentSearchResult[]>;
  getQuote(symbol: string): Promise<QuoteSnapshot>;
  getDailyPrices(
    symbol: string,
    from: string,
    to: string
  ): Promise<DailyPrice[]>;
}
```

## 17.3 Adapter

```text
lib/market-data/
├── provider.ts
├── normalize.ts
├── yahoo/
│   ├── client.ts
│   ├── mapper.ts
│   ├── search.ts
│   ├── quote.ts
│   └── chart.ts
└── mock/
    └── provider.ts
```

## 17.4 禁止事項

- Client ComponentからProviderを直接呼ばない
- ブラウザからYahooへ直接アクセスしない
- Yahooのレスポンス型をReact Componentのpropsへ渡さない
- API障害時に0を保存しない
- 過去の正常値を空値で上書きしない
- 1銘柄の失敗で全バッチを失敗させない

---

# 18. 銘柄シンボル正規化

## 18.1 日本株

- 表示コード: `7203`
- Provider symbol: `7203.T`
- market: `JP`
- currency: `JPY`

## 18.2 米国株

- 表示コード: `AAPL`
- Provider symbol: `AAPL`
- market: `US`
- currency: `USD`

## 18.3 内部ID

UIルートやDB参照は、可能な限りUUIDを使用する。

Provider symbolは変更可能性があるため、主キーにしない。

## 18.4 正規化規則

- 大文字化
- 前後空白除去
- 全角数字を半角化
- 日本株の4桁入力は検索時に`.T`候補を生成
- 同一symbol・exchangeの重複排除
- 銘柄名の空文字を許可しない

---

# 19. データ更新設計

## 19.1 更新頻度

個人利用・週足/月足用途のため、日次1回を基本とする。

推奨実行時刻:

- 08:30 JST前後

この時点で、米国市場の直近終値と、日本市場の前営業日終値をまとめて取得する。

## 19.2 手動更新

ヘッダーの更新ボタンから実行可能。

制約:

- 同一ユーザーは10分に1回
- 実行中は再実行不可
- 前回成功時刻を表示
- 完了後に対象画面を再検証
- 失敗銘柄数を表示
- 全件成功と部分成功を区別

## 19.3 初回お気に入り追加

新規銘柄追加時に以下を取得。

- 銘柄基本情報
- 最新Quote
- 過去10年の日足
- 10年未満しか存在しない場合は取得可能期間
- 同期状態

## 19.4 差分更新

毎日の同期では、直近10暦日を再取得してupsertする。

理由:

- 祝日差
- 修正値
- 取得失敗回復
- タイムゾーン境界
- 株式分割等の反映

## 19.5 冪等性

`instrument_id + trading_date`を一意制約にする。

同じ同期を複数回実行しても、行数・集計値が不正に増えないこと。

## 19.6 部分失敗

100銘柄中3銘柄が失敗した場合:

- 97銘柄を正常保存
- 3銘柄を失敗記録
- sync runは`partial_success`
- UIは前回データを表示
- 次回同期で再試行

---

# 20. 週足・月足集計

DBには日足を保存し、週足・月足はサーバー側で集計する。

## 20.1 週足

- 期間: ISO week
- open: 最初の取引日のopen
- high: 期間中の最大high
- low: 期間中の最小low
- close: 最後の取引日のclose
- adjustedClose: 最後の取引日のadjustedClose
- volume: 合計
- 欠損日は無視
- 取引日が1日でもあれば足を生成

## 20.2 月足

- 暦月で集計
- open: 最初の取引日
- high: 最大
- low: 最小
- close: 最後の取引日
- adjustedClose: 最後の取引日
- volume: 合計

## 20.3 並び順

昇順で返却する。

## 20.4 表示用途

- ローソク足: raw OHLC
- 長期リターン: adjustedClose
- 前営業日比: raw close
- 比較チャート: adjustedClose

## 20.5 テスト必須ケース

- 月曜が祝日
- 金曜が祝日
- 月末が休日
- 年末年始
- 1週間に1営業日のみ
- 欠損OHLC
- 株式分割前後
- 同日重複データ
- 日付順が逆

---

# 21. 為替換算

## 21.1 基本方針

MVPでは株価そのものを現地通貨で表示する。

- 日本株: JPY
- 米国株: USD

JPY換算は補助表示とする。

## 21.2 換算式

```text
JPY value = USD value × USDJPY rate
```

## 21.3 為替日付

株価日付と同日または直前の利用可能な為替レートを使用する。

未来日の為替レートを過去株価へ適用しない。

## 21.4 UI表示

```text
$195.27
約 ¥29,480
換算レート: 1 USD = 151.00 JPY
為替基準日: 2026-06-30
```

---

# 22. データベース設計

Supabase PostgreSQLを使用する。

## 22.1 instruments

```sql
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'yahoo',
  provider_symbol text not null,
  display_symbol text not null,
  name text not null,
  exchange text,
  market text not null check (market in ('JP', 'US')),
  currency text not null check (currency in ('JPY', 'USD')),
  instrument_type text not null check (
    instrument_type in ('stock', 'etf', 'index')
  ),
  sector text,
  industry text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_symbol)
);
```

## 22.2 favorites

```sql
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, instrument_id)
);
```

## 22.3 daily_prices

```sql
create table public.daily_prices (
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  trading_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adjusted_close numeric,
  volume bigint,
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  primary key (instrument_id, trading_date)
);

create index daily_prices_instrument_date_desc_idx
  on public.daily_prices (instrument_id, trading_date desc);
```

## 22.4 quote_snapshots

```sql
create table public.quote_snapshots (
  instrument_id uuid primary key references public.instruments(id) on delete cascade,
  price_date date,
  fetched_at timestamptz not null default now(),
  close numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  dividend_yield numeric,
  market_cap numeric,
  trailing_pe numeric,
  forward_pe numeric,
  raw_currency text
);
```

## 22.5 fx_rates

```sql
create table public.fx_rates (
  pair text not null,
  rate_date date not null,
  close numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (pair, rate_date)
);
```

## 22.6 sync_runs

```sql
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (
    trigger_type in ('cron', 'manual', 'initial_backfill')
  ),
  status text not null check (
    status in ('running', 'success', 'partial_success', 'failed')
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  requested_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  error_summary jsonb
);
```

## 22.7 sync_items

```sql
create table public.sync_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  instrument_id uuid references public.instruments(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
```

---

# 23. 認証・認可

## 23.1 認証

Supabase Authを使用する。

MVP候補:

- Email OTP
- Magic Link

パスワード管理を自前実装しない。

## 23.2 個人利用制限

`ALLOWED_EMAILS`または`allowed_users`テーブルで利用者を制限する。

未許可メールはログイン成功後でもアプリデータへアクセスさせない。

## 23.3 RLS

以下のユーザー依存テーブルはRLSを有効化。

- favorites
- Phase 2のpositions
- Phase 2のtransactions

例:

```sql
alter table public.favorites enable row level security;

create policy "users can read own favorites"
on public.favorites
for select
using (auth.uid() = user_id);

create policy "users can insert own favorites"
on public.favorites
for insert
with check (auth.uid() = user_id);

create policy "users can delete own favorites"
on public.favorites
for delete
using (auth.uid() = user_id);
```

## 23.4 Service Role

- ブラウザへ公開しない
- cron・サーバー同期のみ使用
- `NEXT_PUBLIC_`を付けない

## 23.5 Cron認証

`CRON_SECRET`を使用する。

Authorizationヘッダーが一致しない場合は401。

---

# 24. API設計

## 24.1 GET /api/search

### Query

```text
q=apple
market=US
limit=10
```

### Response

```json
{
  "data": [
    {
      "id": null,
      "providerSymbol": "AAPL",
      "displaySymbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "market": "US",
      "currency": "USD",
      "instrumentType": "stock",
      "isFavorite": false
    }
  ],
  "meta": {
    "source": "provider",
    "query": "apple"
  }
}
```

## 24.2 GET /api/favorites

市場、ソート、ページネーションを受け付ける。

```text
market=ALL|JP|US
sort=created_at|change_percent|return_1y|name
order=asc|desc
```

## 24.3 POST /api/favorites

```json
{
  "providerSymbol": "AAPL"
}
```

処理:

1. 認証
2. instrument upsert
3. favorite insert
4. 初回データの有無確認
5. 必要ならbackfill起動
6. response

## 24.4 DELETE /api/favorites/[instrumentId]

- 自分のfavoriteのみ削除
- instrument・価格履歴は削除しない

## 24.5 GET /api/stocks/[symbol]

- 銘柄基本情報
- Quote
- お気に入り状態
- 鮮度情報

## 24.6 GET /api/stocks/[symbol]/chart

### Query

```text
interval=week|month
range=1y|3y|5y|10y|max
mode=candlestick|line
currency=local|jpy
```

## 24.7 POST /api/sync/manual

- 認証必須
- レート制限
- 実行中ロック
- 部分成功レスポンス
- UI再検証用タグを返す

## 24.8 GET /api/cron/daily-sync

- CRON_SECRET
- 冪等
- ロック
- ログ
- キャッシュ再検証

## 24.9 API共通エラー

```json
{
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "市場データの取得に時間がかかっています。",
    "retryable": true,
    "requestId": "..."
  }
}
```

内部スタックトレースをブラウザへ返さない。

---

# 25. キャッシュ戦略

## 25.1 原則

DBをアプリの主要読み取り元にする。

画面表示のたびにYahoo Financeへアクセスしない。

## 25.2 Server Cache

- 市場概要: 1時間
- お気に入り一覧: ユーザー操作後に無効化
- 銘柄詳細: 同期後に無効化
- チャート: 銘柄・足種・期間単位でキャッシュ

## 25.3 TanStack Query

Client側で使用する対象:

- 検索
- お気に入り追加・解除
- 手動同期状態
- フィルター付きテーブル

推奨query key:

```ts
["search", query, market]
["favorites", market, sort, order]
["stock", instrumentId]
["chart", instrumentId, interval, range, currency]
["sync-status"]
```

## 25.4 再検証

同期成功後:

- favorites
- japan
- us
- stock detail
- chart

をタグ単位で再検証する。

---

# 26. フロントエンド技術構成

## 26.1 採用

- Next.js App Router
- TypeScript strict
- React
- Tailwind CSS
- shadcn/uiをプリミティブとして利用可
- lucide-react
- Lightweight Charts
- TanStack Query
- TanStack Table
- Zod
- Supabase
- Playwright
- Vitest
- Testing Library
- ESLint
- Prettier

## 26.2 非採用

- Redux
- Zustand
- WebSocket
- Socket.IO
- Redux Toolkit
- 重いチャートライブラリの複数併用
- CSS-in-JS
- jQuery
- Moment.js
- 独自UIライブラリの過剰構築

## 26.3 Server / Client分離

Server Component:

- page
- layout
- 初期データ取得
- 認証確認
- DB読み取り
- メタデータ

Client Component:

- 検索入力
- お気に入り操作
- チャート
- 期間切り替え
- テーブルソート
- モバイルドロワー
- トースト

ページ全体を`"use client"`にしない。

---

# 27. 推奨ディレクトリ構成

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── favorites/
│   │   ├── japan/
│   │   ├── us/
│   │   ├── stocks/
│   │   │   └── [symbol]/
│   │   └── settings/
│   └── api/
│       ├── search/
│       ├── favorites/
│       ├── markets/
│       ├── stocks/
│       ├── sync/
│       ├── cron/
│       └── health/
├── components/
│   ├── app-shell/
│   ├── charts/
│   ├── search/
│   ├── stocks/
│   ├── tables/
│   ├── freshness/
│   ├── feedback/
│   └── ui/
├── features/
│   ├── auth/
│   ├── favorites/
│   ├── instruments/
│   ├── markets/
│   ├── prices/
│   └── sync/
├── lib/
│   ├── market-data/
│   ├── aggregation/
│   ├── currency/
│   ├── supabase/
│   ├── validation/
│   ├── errors/
│   └── utils/
├── server/
│   ├── repositories/
│   ├── services/
│   └── jobs/
├── types/
└── config/

supabase/
├── migrations/
├── seed.sql
└── tests/

tests/
├── unit/
├── integration/
├── e2e/
└── visual/

docs/
├── architecture.md
├── data-model.md
├── ui-spec.md
└── adr/
```

---

# 28. コンポーネント設計

## 28.1 App Shell

- `AppSidebar`
- `MobileBottomNav`
- `DashboardHeader`
- `FreshnessIndicator`
- `UserMenu`

## 28.2 Search

- `GlobalStockSearch`
- `SearchCommandDialog`
- `SearchResultGroup`
- `SearchResultItem`
- `FavoriteToggle`

## 28.3 KPI

- `MetricCard`
- `MetricValue`
- `MetricDelta`
- `MetricTooltip`

## 28.4 Chart

- `StockChart`
- `ChartToolbar`
- `IntervalToggle`
- `RangeToggle`
- `ChartTypeToggle`
- `ChartTooltip`
- `ChartEmptyState`
- `ChartErrorState`

## 28.5 Table

- `StockTable`
- `StockMobileCard`
- `Sparkline`
- `MarketBadge`
- `CurrencyValue`
- `PercentChange`
- `DataDate`

## 28.6 Feedback

- `PageSkeleton`
- `CardSkeleton`
- `TableSkeleton`
- `InlineError`
- `EmptyState`
- `SyncStatusToast`

---

# 29. チャート実装要件

## 29.1 ライブラリ

Lightweight ChartsをClient Component内で使用する。

## 29.2 ライフサイクル

- DOM生成後にchartを作成
- ResizeObserverで幅追従
- unmount時にremove
- series再作成を最小化
- data変更時はsetData
- 期間末尾へfitContent
- 0幅時に生成しない

## 29.3 カラー

日本の一般的な赤上昇・青下落ではなく、アプリ全体で統一する。

- 上昇: green
- 下落: red
- ライン: primary blue
- グリッド: border
- crosshair: slate

## 29.4 ツールチップ

表示:

- 日付または期間
- open
- high
- low
- close
- change
- changePercent
- volume

## 29.5 データ不足

- 1件: ラインを描かず値だけ表示
- 0件: 空状態
- OHLC欠損: ラインチャートへフォールバック可能
- 全期間が重い場合: 週足・月足集計後データのみ送信

---

# 30. テーブル実装要件

## 30.1 デスクトップ

固定ヘッダーを使用可。

行高さ: 60–64px。

## 30.2 セル

### 銘柄

- モノグラム
- 銘柄名
- ticker
- exchange

### 最新終値

- 通貨記号
- 桁区切り
- 小数桁を市場に応じて調整

### 前営業日比

- 金額
- %
- arrow icon
- 符号

### ミニチャート

- 1年
- adjusted close
- 80–120px幅
- hover詳細不要

## 30.3 行操作

- 星
- 詳細
- 追加メニューはMVPでは不要

## 30.4 モバイル

1銘柄1カード。

表示:

- 銘柄名
- ticker
- 最新終値
- 前営業日比
- 1年騰落率
- sparkline
- favorite

---

# 31. ローディング状態

## 31.1 初期ページ

- サイドバーは即表示
- KPIカードスケルトン
- チャートスケルトン
- 表スケルトン5行

## 31.2 検索

- 入力欄は操作可能
- 300ms以上かかる場合のみspinner
- 前回候補を残しつつ更新中表示

## 31.3 チャート切り替え

チャート全体を消さず、軽いoverlay loaderを表示する。

## 31.4 お気に入り追加

ボタンをoptimistic更新。画面全体をブロックしない。

---

# 32. エラー状態

## 32.1 Provider障害

```text
最新データを取得できませんでした
前回取得したデータを表示しています
最終正常取得: 2026-06-30 08:41
[再試行]
```

## 32.2 チャートデータなし

```text
この期間の価格データがありません
期間を短くするか、後でもう一度お試しください
```

## 32.3 認証切れ

ログインページへ遷移し、戻り先を保持する。

## 32.4 部分同期失敗

```text
12銘柄中10銘柄を更新しました
2銘柄は前回データを表示しています
[詳細]
```

## 32.5 404

銘柄が存在しない場合、検索への導線を表示。

---

# 33. アクセシビリティ

- WCAG 2.1 AAを目標
- キーボード操作
- focus-visible
- aria-label
- icon-only buttonにラベル
- 検索候補はcombobox/listbox
- table headerにscope
- chartに代替テキスト
- 色以外の上昇・下落表現
- 文字サイズを12px未満にしない
- タップ領域44px以上
- reduce motion対応

---

# 34. パフォーマンス要件

- 初期表示で不要なProvider呼び出し禁止
- チャートをdynamic import
- 検索結果最大10件
- テーブル初期表示最大25件
- N+1 query禁止
- 価格履歴は必要期間のみ取得
- sparkline用データは別の軽量レスポンス
- 画像ロゴを大量にロードしない
- 同期時のProvider並列数を3–5に制限
- timeoutを設定
- exponential backoff
- retry上限
- 失敗隔離

---

# 35. セキュリティ

- Provider呼び出しはサーバーのみ
- Service Roleをクライアントへ送らない
- RLS
- Zod validation
- SQLインジェクションを避ける
- rate limiting
- CRON_SECRET
- allowed email
- HTTP errorの内部情報を隠す
- ログへアクセストークンを出さない
- `.env.local`をcommitしない
- CSPを可能な範囲で設定
- 外部ロゴURLを無制限許可しない

---

# 36. 環境変数

`.env.example`

```bash
NEXT_PUBLIC_APP_NAME=StockScope
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ALLOWED_EMAILS=
CRON_SECRET=

MARKET_DATA_PROVIDER=yahoo
MANUAL_SYNC_COOLDOWN_MINUTES=10
INITIAL_BACKFILL_YEARS=10
SYNC_CONCURRENCY=4
PROVIDER_TIMEOUT_MS=12000

ENABLE_PORTFOLIO=false
ENABLE_JPY_CONVERSION=true
```

---

# 37. Vercel Cron

## 37.1 Hobby前提

1日1回の同期にまとめる。

`vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/daily-sync",
      "schedule": "30 23 * * *"
    }
  ]
}
```

23:30 UTCは08:30 JST相当。

実際の呼び出し時刻に幅があることを前提に、価格基準日と取得日時を分けて表示する。

## 37.2 Cron要件

- Authorization検証
- 実行ロック
- 冪等
- 前回未完了runの検出
- 失敗時ログ
- 部分成功
- 自動リトライに依存しない
- 次回runで未処理を回収

---

# 38. ロギング・運用

## 38.1 ログ項目

- requestId
- syncRunId
- instrumentId
- providerSymbol
- phase
- durationMs
- status
- errorCode

## 38.2 UIで確認可能

設定画面に以下を表示。

- 最終同期
- 最終成功
- 対象銘柄数
- 成功数
- 失敗数
- 手動同期
- 直近5回の履歴

## 38.3 Health

`/api/health`

確認:

- app
- database
- providerは常時叩かず、直近同期状態
- latest successful sync

---

# 39. テスト戦略

## 39.1 Unit Test

必須:

- symbol normalization
- JP / US market detection
- weekly aggregation
- monthly aggregation
- range filtering
- adjusted return
- favorite basket index
- FX conversion
- freshness status
- quote normalization
- null handling

## 39.2 Integration Test

必須:

- favorite insert duplicate
- favorite user isolation
- RLS
- instrument upsert
- daily price upsert
- sync idempotency
- partial failure
- manual cooldown
- cron secret
- chart API response
- search normalization

## 39.3 E2E

Playwright:

1. Login
2. favorites empty state
3. search Toyota
4. add favorite
5. chart appears
6. switch weekly/monthly
7. switch range
8. Japan page
9. US page
10. search Apple
11. add favorite
12. favorites cross-market display
13. remove and undo
14. mobile navigation

## 39.4 Visual Regression

基準画面:

- favorites desktop
- japan desktop
- us desktop
- stock detail desktop
- favorites mobile
- search dialog
- loading
- empty
- provider error

## 39.5 Mock Provider

テストでYahooへアクセスしない。

固定fixtureを使用する。

---

# 40. コード品質

- TypeScript `strict: true`
- `any`禁止。例外は理由コメント必須
- 関数は単一責務
- UI ComponentからDBへ直接アクセスしない
- repository / service / providerを分離
- domain typeを中心に設計
- external response validation
- エラーコードを型定義
- 日付文字列のフォーマットを統一
- 金額計算に浮動小数の誤差が問題になる箇所ではDB numericを使用
- コメントは「何を」ではなく「なぜ」
- 使われない抽象化を先に作らない
- ただしProvider境界は最初から作る

---

# 41. 実装フェーズ

## Phase 0: Repository Setup

- Next.js
- TypeScript
- Tailwind
- lint
- format
- test
- env
- README
- CI

完了条件:

- dev起動
- build成功
- lint成功
- test成功

## Phase 1: Design Shell

- Sidebar
- Header
- responsive
- pages
- mock data
- reference imageに近いUI
- no backend

完了条件:

- 3ページの外観
- desktop/mobile
- visual regression

## Phase 2: Auth / DB

- Supabase
- migrations
- Auth
- allowed user
- RLS
- repositories

完了条件:

- 他ユーザーデータへアクセス不可
- migration再実行可能

## Phase 3: Provider / Search

- yahoo adapter
- normalized types
- search API
- search dialog
- error handling

完了条件:

- JP/US検索
- browser direct callなし
- mock provider tests

## Phase 4: Favorites

- add
- remove
- undo
- optimistic update
- empty state
- filters

完了条件:

- duplicateなし
- user isolation
- navigation refresh不要

## Phase 5: Price History / Chart

- daily storage
- backfill
- weekly/monthly aggregation
- chart API
- Lightweight Charts

完了条件:

- 10年表示
- 週/月切替
- mobile resize
- null-safe

## Phase 6: Market Pages

- Japan overview
- US overview
- benchmark charts
- market-specific favorites
- freshness

完了条件:

- UI/UX完全統一
- currencyの誤認なし

## Phase 7: Sync

- cron
- manual sync
- sync history
- idempotency
- partial failure
- locks

完了条件:

- 同期二重実行で重複なし
- 失敗時も前回値表示
- CRON_SECRET

## Phase 8: Polish

- accessibility
- performance
- E2E
- visual regression
- docs
- deploy

---

# 42. Definition of Done

以下をすべて満たすまで完成扱いにしない。

## UI

- [ ] 参考UIのトンマナを反映
- [ ] 左サイドバーは3項目のみ
- [ ] 余白・カード・表の整合
- [ ] デスクトップで崩れない
- [ ] モバイルで表がカード化
- [ ] ローディング・空・エラーあり
- [ ] 架空の資産金額なし

## UX

- [ ] 検索から追加まで3アクション以内
- [ ] 週足・月足を1クリック切替
- [ ] JP/USページが同じ操作体系
- [ ] 前営業日比表記
- [ ] 価格基準日表示
- [ ] お気に入り解除Undo
- [ ] 欠損を0表示しない

## Data

- [ ] Provider abstraction
- [ ] 日足保存
- [ ] 週足集計
- [ ] 月足集計
- [ ] adjusted close用途分離
- [ ] 冪等upsert
- [ ] 部分失敗
- [ ] freshness

## Security

- [ ] Auth
- [ ] allowed user
- [ ] RLS
- [ ] Service Role非公開
- [ ] CRON_SECRET
- [ ] server-only provider

## Quality

- [ ] strict TypeScript
- [ ] lint
- [ ] unit tests
- [ ] integration tests
- [ ] E2E
- [ ] visual regression
- [ ] build
- [ ] README
- [ ] migrations

---

# 43. 受け入れテストシナリオ

## Scenario 1: 初回ログイン

Given 許可メールのユーザー  
When Magic Linkでログイン  
Then `/favorites`へ遷移  
And 空状態が表示  
And JP/USの検索が可能

## Scenario 2: 日本株追加

Given favoritesが空  
When `7203`で検索  
And トヨタ自動車を追加  
Then 星が選択状態  
And favoritesに表示  
And 日本株ページにも表示  
And backfill中は同期中表示  
And 完了後に週足が表示

## Scenario 3: 米国株追加

When `AAPL`を追加  
Then favoritesに日本株と米国株が混在  
And 市場バッジが正しい  
And USD表示  
And 市場比率が更新

## Scenario 4: 足種切替

Given 銘柄詳細  
When 月足を選択  
Then 月単位OHLCへ変化  
And 選択状態が保持  
And URLまたは状態が復元可能

## Scenario 5: Provider障害

Given providerがtimeout  
When 同期  
Then 前回データが残る  
And stale表示  
And sync runがfailedまたはpartial  
And 画面全体はクラッシュしない

## Scenario 6: お気に入り解除

When 星を解除  
Then 行が消える  
And Undo表示  
When Undo  
Then 元へ戻る

## Scenario 7: モバイル

Given 390px幅  
Then sidebarは非表示  
And bottom nav表示  
And chartは画面幅  
And tableはカード  
And 横方向のページ全体スクロールなし

---

# 44. 禁止事項

- 要件にない売買機能を追加しない
- 全銘柄を毎日同期しない
- リアルタイムと誤認させない
- 「現在値」とだけ表示しない
- fake dataを本番UIへ残さない
- 保有情報なしで評価額を表示しない
- Yahooレスポンスをそのまま保存しない
- ProviderをClientから呼ばない
- ページ全体をClient Componentにしない
- 1銘柄失敗で全同期をrollbackしない
- 欠損値を0に変換しない
- 同期中に前回値を消さない
- red/greenだけで変動を表現しない
- 企業ロゴ取得のための不安定なスクレイピングを追加しない
- 参考画像の数値を本番初期値にしない
- UIを証券会社ターミナル風にしない
- 過剰なアニメーションを入れない
- 不要な状態管理ライブラリを追加しない

---

# 45. 実装AIが最初に出力するもの

実装開始前に、以下を提示すること。

1. 実装方針
2. 採用技術
3. フォルダ構成
4. DBスキーマ概要
5. Provider境界
6. 画面一覧
7. 実装フェーズ
8. リスク
9. MVP外
10. Definition of Done

ただし、承認待ちで作業を停止せず、同一セッション内でPhase 0とPhase 1の実装を開始してよい。

---

# 46. 実装AIへ渡す短縮実行プロンプト

以下の文書全体を最上位仕様として読み込み、日本株・米国株を横断する個人向け長期投資Webアプリ「StockScope」を実装してください。

重要条件:

- Next.js App Router + TypeScript
- SaaS風の白基調・ブルーアクセント
- 左サイドバーは「お気に入り銘柄」「日本株」「米国株」の3項目のみ
- 日次更新
- 週足・月足中心
- 日本株・米国株の統一検索
- お気に入り追加・解除
- 銘柄詳細
- yahoo-finance2はサーバー側Provider Adapterとして利用
- DBはSupabase PostgreSQL
- RLS必須
- Vercel Cronは日次1回
- 架空の評価額を表示しない
- 「現在値」ではなく「最新終値」
- 「本日の騰落」ではなく「前営業日比」
- 価格基準日と取得日時を分けて表示
- 日足を保存し、週足・月足を自前集計
- raw OHLCとadjusted closeの用途を分離
- Provider障害時は前回データを表示
- cron・upsertは冪等
- デスクトップ優先、モバイル対応
- Unit / Integration / E2E / Visual Regressionを実装
- README、env.example、migration、seed、テストを含める
- ページ全体をClient Componentにしない
- 仕様外機能を追加しない

参考UI画像の見た目を再現するだけではなく、本指示書に定義したUX・データ鮮度・エラー処理・セキュリティ・保守性を満たす完成形にしてください。

---

# 47. 最終成果物

以下を提出すること。

```text
1. 動作するGitリポジトリ
2. Vercel Preview URL
3. Supabase migration
4. .env.example
5. README
6. アーキテクチャ図
7. ER図
8. API一覧
9. テスト結果
10. Lighthouse結果
11. Visual Regression画像
12. 既知の制約
13. Phase 2候補
```

---

# 48. 最終判断基準

このアプリは、機能数ではなく以下で評価する。

- 見やすいか
- 迷わないか
- データ鮮度を誤解しないか
- 日本株と米国株の操作が統一されているか
- 長期投資で本当に使う情報が前面にあるか
- 無料枠で安定運用できるか
- データProviderを将来交換できるか
- 障害時にも壊れず前回データを提示できるか
- 個人情報・お気に入り情報が公開されないか
- 実装者が変わっても保守できるか

以上を満たすことを、StockScope MVPの完成条件とする。
