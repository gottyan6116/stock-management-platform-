# My portfolio DB Redesign Design

- Status: Approved visual direction, pending written-spec review
- Date: 2026-08-16
- Product name: `My portfolio DB`
- Reference direction: Similarweb-like bright analytics SaaS, adapted for investment research
- Primary user: One long-term individual investor

## 1. Product Outcome

My portfolio DB helps the user keep the total portfolio in profit and grow that profit over the long term. The product does not optimize for a fixed profit amount and does not promise returns. It organizes evidence, estimates possible outcomes, exposes downside risk, and leaves the final investment decision to the user.

The default question is:

> Is the portfolio still positioned to remain profitable and grow over one to three years, and what evidence could change that judgment?

The home page therefore prioritizes portfolio-level profit, long-term holding quality, candidates for review, and the strength and freshness of the supporting evidence. Intraday movement and order-book data remain available as supporting context but do not dominate the long-term score.

## 2. Scope Decomposition

The full vision contains four independently testable releases. They must be implemented in this order.

### Release 1: Brand, navigation, and UI/UX foundation

- Rename StockScope to My portfolio DB in user-visible copy and metadata.
- Replace the current navigation with the approved information architecture.
- Rebuild the home page using the approved Similarweb-inspired visual system.
- Reuse real position, price, favorites, fund, and simulation data where the current application already provides it.
- Add typed mock research outlooks only where live research data does not yet exist; every mock state must be visibly labelled as sample data.
- Keep the existing authentication and user isolation behavior unchanged.

### Release 2: Structured research foundation in Supabase

- Add normalized evidence, event, signal, outlook, and prediction-evaluation tables.
- Connect the home page and instrument detail page to the new repositories.
- Store source URL, source type, publication time, ingestion time, freshness, and model version for each result.
- Add Row Level Security to every exposed table. User-owned records use `user_id = auth.uid()` ownership checks. Shared market research tables are read-only to authenticated users and writable only by server-side ingestion.

### Release 3: Cloudflare collection pipeline

- Use Cloudflare R2 for raw PDFs, HTML, JSON, CSV, and generated research artifacts.
- Use Cloudflare Workers for collection, normalization, scheduled dispatch, and lightweight AI extraction.
- Begin with held instruments and favorites only, targeting 10 to 30 instruments.
- Prioritize official and licensed sources: price provider, company IR, TDnet, EDINET, J-Quants when credentials permit, and explicitly licensed news or market-data providers.
- Order-book data is displayed only when an authorized provider is available. Delayed data must show its delay.
- Paywalled reports and content prohibited by source terms must not be scraped or copied into storage.

### Release 4: Forecasting and validation

- Separate LLM document extraction from quantitative forecasting.
- Produce one-year and three-year portfolio and instrument outlooks by default.
- Retain three-month context for catalysts and risk, but do not make it the home-page focus.
- Record forecast version, input cutoff, benchmark, predicted range, confidence, and later realized outcome.
- Provide a prediction-performance page so the user can see calibration and past errors.

## 3. Information Architecture

### Primary navigation

1. Asset growth home (`資産成長ホーム`)
2. Portfolio (`保有資産`)
3. Long-term candidates (`長期保有の候補`)
4. Compare and benchmark (`比較・ベンチマーク`)

### Research group

1. Instrument analysis (`銘柄分析`)
2. Chart, order book, and supply/demand (`チャート・板・需給`)
3. Competitor comparison (`競合比較`)

### Company information group

1. Earnings and financials (`決算・財務`)
2. Disclosures and M&A (`重要発表・M&A`)
3. Management and investor statements (`経営者・投資家の発言`)

### Validation group

1. Prediction performance (`予測の成績`)
2. Trading simulation (`シミュレーション`)
3. Settings (`設定`)

Existing Japan, US, favorites, funds, portfolio, and simulation features are not deleted. They are reorganized under the new navigation and linked from the relevant pages. Japanese and US market distinctions become filters and badges instead of competing top-level destinations.

## 4. Home Page Design

### Header report card

- Product context: `資産成長レポート`
- Range control: held assets, one year, three years, five years
- Global instrument search remains available without leaving the page.
- Data freshness and last successful update are always visible.

### Portfolio status metrics

1. Current total valuation
2. Total unrealized profit or loss
3. Estimated probability that the portfolio remains positive over the selected horizon
4. Downside-risk level and number of review candidates
5. Evidence completeness

The profit or loss metric is the primary status. No fixed `+¥10,000` goal is shown. Positive status means the portfolio total is above total acquisition cost.

### Portfolio composition and quality

- Multi-color allocation chart with instrument and fund categories
- Per-holding profit or loss
- One-to-three-year outlook score
- Clear action language: `保有継続`, `様子を見る`, `見直す`
- Concentration, financial quality, earnings stability, growth runway, valuation risk, and downside exposure

### Research coverage

The page displays whether each evidence category is current and complete:

- Historical prices and charts
- Earnings and financial reports
- Competitors and industry context
- Order book and supply/demand
- Management, investors, finance professionals, and business-leader statements
- M&A and material disclosures

Each category links to its source list. Missing or stale categories must be explicit and must reduce `根拠の充実度`.

## 5. Instrument Detail Design

The instrument detail page uses page-level tabs:

1. Overview (`概要`)
2. Outlook (`見通し`)
3. Chart and supply/demand (`チャート・需給`)
4. Financials (`決算・財務`)
5. Competitors (`競合比較`)
6. Disclosures and statements (`開示・発言`)
7. Evidence (`根拠資料`)

The Outlook tab shows one year and three years first. It contains:

- `プラスの可能性`
- `比較指数を上回る可能性`
- Expected range, not a single precise future price
- `下落リスク`
- `根拠の強さ`
- `期待できる材料`
- `注意すべき材料`
- `まだ確認できていない点`
- Source and model update time

## 6. Plain-Language Terminology

The interface must not use unexplained finance or model jargon.

| Avoid | Use |
|---|---|
| Bull case | 期待できる材料 |
| Bear case | 注意すべき材料 |
| Base case | 現時点の中心的な見通し |
| Confidence | 根拠の強さ |
| Outperform probability | 比較指数を上回る可能性 |
| Catalyst | 上昇につながるきっかけ |
| Thesis | 保有を続ける理由 |
| Revision score | 業績予想の変化 |

Technical terms may appear in source details when their meaning is explained next to them.

## 7. Visual System

The implementation adapts the design DNA of the approved Similarweb reference without copying its branding, logo, or exact layouts.

### Color tokens

- Page background: `#F5F8FD`
- Surface: `#FFFFFF`
- Primary blue: `#4D7CFF`
- Primary blue soft: `#EEF3FF`
- Heading navy: `#26375D`
- Body text: `#445674`
- Muted text: `#8796AA`
- Border: `#E0E7F0`
- Positive green: `#5DB852`
- Positive soft: `#DFFBD8`
- Risk coral: `#EF5C49`
- Risk soft: `#FFE6E1`
- Comparison orange: `#FF813E`
- Secondary mint: `#58C3A2`
- Secondary cyan: `#45B3D8`
- Secondary yellow: `#F5B936`

### Layout and components

- White sidebar with grouped pale-blue sections
- Blue active navigation item
- Dense desktop-first analytical layout with a mobile bottom navigation fallback
- Card radius: 5 to 8 pixels
- Thin borders and restrained shadows
- Metric cards may share one segmented surface when they form a comparison set
- Color communicates data meaning; it is not decorative
- Charts use blue as the primary series and the semantic secondary colors for comparisons
- Japanese text uses `Noto Sans JP` or the existing system fallback; numeric data uses tabular figures
- No gradients, decorative blobs, oversized marketing typography, or nested cards

## 8. Data Model Direction

Existing tables remain the source for instruments, favorites, daily prices, quotes, positions, manual fund prices, and simulation data.

New structured concepts are:

- `research_evidence`: source metadata and R2 object reference
- `company_events`: earnings, guidance, M&A, buybacks, material contracts, and other events
- `financial_snapshots`: normalized period financial metrics
- `investment_signals`: factor values by instrument, date, and horizon
- `investment_outlooks`: human-readable outlook and quantitative outputs by instrument and model version
- `prediction_evaluations`: realized results and calibration records
- `portfolio_outlooks`: portfolio-level positive probability, downside risk, concentration, and evidence completeness

Indexes must support instrument plus date, portfolio user plus date, and source freshness queries. Large raw documents and long historical files belong in R2, not in Postgres. Supabase stores searchable structured data and application state.

## 9. Forecast Semantics

- A forecast is an estimate with uncertainty, never a guarantee or a buy/sell order.
- Long-term scores weight financial quality, growth, valuation, competitive strength, cash generation, debt, and risk.
- Price momentum, order book, supply/demand, and short-lived statements are supporting features with lower long-term weight.
- LLMs extract facts, claims, risks, and citations into structured records. They do not invent numeric probabilities.
- Numeric probabilities come from a versioned scoring or statistical model and must be validated against historical outcomes.
- The UI must show input cutoff time, data freshness, model version, and evidence gaps.
- A precise target price is not shown until the model can produce a validated range with documented assumptions.

## 10. Failure and Empty States

- If research data is unavailable, show `分析データがまだありません` and retain the existing portfolio and price experience.
- If only some evidence sources fail, show partial results and the missing category. Do not silently lower coverage.
- Stale data uses an explicit date and stale indicator.
- External-provider failures do not remove stored historical research.
- Sample data is never mixed with live results without a visible `サンプル` label.

## 11. Security and Source Compliance

- Supabase service-role credentials remain server-only.
- Every table in an exposed schema has RLS.
- User-owned data uses owner predicates for select, insert, update, and delete.
- Shared research data is read-only to authenticated clients.
- Raw source documents use private R2 buckets and signed access when opened.
- Source terms, copyright, robots restrictions, redistribution limits, and market-data licensing are respected.
- Passwords, API keys, and provider tokens never enter Git history or browser-delivered code.

## 12. Acceptance Criteria

### UX and visual

- The app displays `My portfolio DB` instead of `StockScope` in all user-visible locations.
- The home page follows the approved bright analytics SaaS system.
- The portfolio profit state is visible without scrolling at 1440x900 and common laptop sizes.
- Desktop, tablet, and mobile layouts do not overlap or truncate critical values.
- All interactive controls have keyboard focus, hover, loading, empty, error, and disabled states.

### Behavior

- Existing login, favorites, positions, funds, prices, and simulation workflows continue to work.
- Market filters still distinguish JP and US instruments.
- Sample and live research data cannot be confused.
- Evidence freshness and model version are visible wherever a forecast is displayed.

### Verification

- Unit tests cover score display mapping, terminology, evidence completeness, horizon selection, and sample/live labels.
- Repository tests, lint, typecheck, and production build pass.
- Browser checks cover desktop and mobile home, portfolio, and instrument-detail flows.
- Supabase migrations are re-runnable and RLS behavior is tested before live application.

## 13. External Dependencies

The following are not assumed to be available during Release 1:

- Valid production login credentials
- Supabase project administration access
- Cloudflare account, R2 bucket, Workers project, and tokens
- J-Quants, EDINET, licensed news, or order-book provider credentials
- Vercel project write access

Release 1 must remain locally testable without these dependencies. Later releases stop at a verified integration boundary when the required account access is unavailable.

## 14. Approved Decisions

- Product name: My portfolio DB
- Home direction: hybrid of decision dashboard and portfolio management
- Default mindset: staying positive is winning; no fixed yen target
- Time horizon: long-term first, one year and three years emphasized
- Analysis language: plain Japanese instead of Bull/Bear jargon
- Visual direction: Similarweb-like bright analytics SaaS
- Final decision remains with the user

