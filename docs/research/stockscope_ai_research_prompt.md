# StockScope AI リサーチプロンプトテンプレート

ChatGPT / Claude / Gemini / Perplexity などの外部AIに銘柄の投資リサーチを依頼するとき、このプロンプトをそのまま貼り付けてください。出力されたJSONは、StockScopeの銘柄詳細ページ →「リサーチ」タブ →「資料を追加」→「JSON」モードにそのまま貼り付けて取り込めます。

**このテンプレートを使わずにAIへ依頼した場合、出力JSONの形式が一致せず「JSON形式が正しくありません」というエラーになります。** 必ずこのプロンプトを使ってください。

---

## 貼り付け用プロンプト（ここから）

```
あなたは投資リサーチアシスタントです。以下の銘柄について調査し、必ず指定したJSON形式のみで出力してください。JSON以外の文章（前置き・説明・コードフェンス）は一切含めないでください。

調査対象:
銘柄: <ここに銘柄名とティッカーを記入。例: NTT (9432)>
取引所: <例: TSE>

調査してほしい内容:
- 直近の株価・時価総額・PER・PBR・配当利回りなどの市場データ
- 直近決算（売上・営業利益・純利益・EPS・営業利益率など）と通期会社予想
- 経営陣の発言（業績見通し、中期経営計画、株主還元方針など）
- 上振れ要因（カタリスト）
- リスク要因
- 重要な適時開示・イベント（自己株買い、増配、M&A、決算発表日など）
- 第三者の投資見解（あれば）
- 総合的な投資判断のサマリー（中長期保有の観点）

重要なルール:
1. 分からない数値は絶対に0や適当な値で埋めない。分からない項目は配列から省略する。
2. 憶測や一般知識で数値を捏造しない。出典が不明確な情報は "summary" 内で「不確実」と明記する。
3. 各情報には必ず出典（sources配列のいずれか）を sourceKey で紐付ける。
4. 日付は必ず YYYY-MM-DD 形式（実在する暦日）にする。不明な日付の出来事（例: 「2023年」としか分からない）は events に含めず、summary の文章内で言及するだけにする。
5. financials の metricKey は、下記の「使用可能なmetricKey一覧」に**ある値だけ**を使う。一覧にない指標（セグメント別売上、理論株価レンジ、シナリオ試算など）は financials に入れず、summary の文章に要約として含める。
6. periodType は "FY"（通期）か "Q"（四半期）のいずれか。periodStart / periodEnd はその期間の開始日・終了日（日本企業の多くは4月始まり〜翌年3月末）。
7. 出力は下記のJSON形式**そのまま**。キー名を変更したり、日本語のキー名にしたりしないこと。

出力するJSON形式（この構造・キー名を厳守）:

{
  "company": { "ticker": "証券コード", "name": "会社名", "exchange": "取引所（例: TSE）" },
  "researchDate": "調査日（YYYY-MM-DD）",
  "sources": [
    {
      "sourceKey": "この調査内で一意な短い識別子（例: src_1）",
      "sourceType": "chatgpt | claude | gemini | perplexity | official_ir | edinet | sec | analyst | investor | news | manual | other のいずれか",
      "sourceName": "情報源の名前（例: 会社名 IR資料、ChatGPT Deep Research など）",
      "sourceUrl": "URL（分かる場合のみ。省略可）",
      "evidenceClass": "fact（一次資料に基づく事実） | opinion（第三者の意見） | ai_interpretation（AI自身の分析・解釈） のいずれか",
      "reliability": "low | medium | high のいずれか（省略可）"
    }
  ],
  "financials": [
    {
      "sourceKey": "対応するsourcesのsourceKey（省略可）",
      "metricKey": "下記一覧のいずれか",
      "value": 数値のみ（文字列にしない、単位や記号を含めない）,
      "unit": "単位（自由記述。例: percent, x, JPY_100M, JPY_TRILLION, JPY_PER_SHARE。省略可）",
      "currency": "JPY | USD（省略可）",
      "periodType": "FY | Q",
      "periodStart": "YYYY-MM-DD",
      "periodEnd": "YYYY-MM-DD"
    }
  ],
  "managementStatements": [
    {
      "sourceKey": "対応するsourceKey（省略可）",
      "personName": "発言者名（個人名が不明なら会社名でよい）",
      "role": "役職（省略可）",
      "statement": "発言内容",
      "statementDate": "YYYY-MM-DD（省略可）",
      "topic": "guidance | strategy | margin | capital_allocation | m_and_a | ai | product | international | shareholder_return | risk | competition | other のいずれか"
    }
  ],
  "catalysts": [
    {
      "sourceKey": "対応するsourceKey（省略可）",
      "description": "上振れ要因の説明",
      "expectedTiming": "想定時期（自由記述。省略可）",
      "impact": "low | medium | high（省略可）"
    }
  ],
  "risks": [
    {
      "sourceKey": "対応するsourceKey（省略可）",
      "riskType": "リスクの種類（自由記述。例: fx, debt, regulation, execution）",
      "description": "リスクの説明",
      "severity": "low | medium | high（省略可）"
    }
  ],
  "investorOpinions": [
    {
      "sourceKey": "対応するsourceKey（省略可）",
      "author": "発言者・分析者名",
      "organization": "所属（省略可）",
      "stance": "見解（自由記述。省略可）",
      "summary": "意見の要約",
      "publishedAt": "YYYY-MM-DD（省略可）"
    }
  ],
  "events": [
    {
      "sourceKey": "対応するsourceKey（省略可）",
      "eventType": "earnings | guidance | m_and_a | buyback | dividend | capital_raise | product | regulation | lawsuit | management_change | restructuring | partnership | other のいずれか",
      "title": "イベント名",
      "description": "説明（省略可）",
      "eventDate": "YYYY-MM-DD（正確な日付が分かる場合のみ。分からなければこのイベント自体を含めない）"
    }
  ],
  "summary": "総合的な調査サマリー。financials等に入らなかった補足情報（セグメント別詳細、理論株価レンジ、シナリオ試算、価格帯別の評価など）もここに文章として含めてよい。"
}
```

## 使用可能な metricKey 一覧

`financials[].metricKey` には、次の21種類のいずれかだけを使用してください（これ以外は受け付けられません）。

| metricKey | 意味 |
|---|---|
| `revenue` | 売上高 |
| `operating_income` | 営業利益 |
| `net_income` | 純利益 |
| `eps` | EPS（1株当たり利益） |
| `fcf` | フリーキャッシュフロー |
| `cash` | 現金及び現金同等物 |
| `debt` | 有利子負債 |
| `roe` | ROE |
| `roic` | ROIC |
| `operating_margin` | 営業利益率 |
| `net_margin` | 純利益率 |
| `per` | PER |
| `pbr` | PBR |
| `ev_ebitda` | EV/EBITDA |
| `dividend_yield` | 配当利回り |
| `dividend_payout` | 配当性向 |
| `current_ratio` | 流動比率（「倍」表記。150%なら1.5と入力） |
| `net_debt` | 純有利子負債 |
| `net_debt_ebitda` | 純有利子負債/EBITDA |
| `fcf_yield` | FCF利回り |
| `fcf_margin` | FCFマージン |

セグメント別業績、株価シナリオ試算、PER別理論株価レンジ、価格帯別の買い時評価などは、上記のmetricKeyに対応する項目がないため `financials` には含めず、`summary` の文章として要約してください（将来のフェーズで専用の項目が追加される可能性があります）。

## 取り込み方法

1. 上記プロンプトの `<ここに銘柄名とティッカーを記入>` 部分を書き換えて外部AIに送る。
2. 出力されたJSONをコピー。
3. StockScopeで対象銘柄のページを開き、「リサーチ」タブ →「資料を追加」→「JSON」を選択。
4. コピーしたJSONを貼り付けて「取り込む」をクリック。
5. エラーが出た場合、メッセージに `(company.ticker)` のようにどの項目が問題かが表示されるので、そこを確認・修正して再送信する。
