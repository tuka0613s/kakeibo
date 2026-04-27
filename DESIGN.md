# 爆速家計簿 技術設計書

## 技術スタック

| レイヤ | 採用技術 | 理由 |
|---|---|---|
| UI | HTML / CSS / Vanilla JS | ビルド不要・Mac なしで即動作 |
| オフライン | Service Worker | PWA 必須要件 |
| データ | localStorage | シンプル・iOS Safari 対応 |
| 配布 | PWA（ホーム画面追加） | App Store 不要・Mac 不要 |

---

## ファイル構成

```
kakeibo/
├── index.html      # アプリ本体（全 CSS・JS を内包）
├── manifest.json   # PWA マニフェスト
├── sw.js           # Service Worker
├── icon-192.png    # PWA アイコン（未生成）
├── icon-512.png    # PWA アイコン（未生成）
├── CLAUDE.md       # Claude への開発指示
├── SPEC.md         # 機能仕様書
├── DESIGN.md       # 技術設計書（本ファイル）
└── PROGRESS.md     # 開発進捗
```

---

## データ設計

### Transaction（取引）

```json
{
  "id":    1,
  "type":  "expense" | "income",
  "cat":   "食費",
  "emoji": "🍜",
  "amt":   1200,
  "date":  "2026-04-27",
  "memo":  "昼食"
}
```

### Category（カテゴリ）

```json
{
  "id":    "e1",
  "name":  "食費",
  "emoji": "🍜"
}
```

支出・収入それぞれ別配列で管理。`type` フィールドは廃止済み（配列で種別を区別）。

### Budget（予算）

```json
{
  "monthly":  200000,
  "alertPct": 80
}
```

`byCat`（カテゴリ別予算）は将来拡張予定。

### 繰越金

ハードコードマップは廃止済み。`getCarryOver(y, m)` が `initialBalance + 過去取引の収支合計` を動的に返す。

---

## localStorage キー一覧

| キー | 型 | 内容 |
|---|---|---|
| `kakebo_txns` | JSON 配列 | 全取引データ |
| `kakebo_next_id` | 数値文字列 | 次の取引 ID |
| `kakebo_layout` | `"A"` or `"B"` | 入力画面レイアウト |
| `kakebo_cats_exp` | JSON 配列 | 支出カテゴリ一覧 |
| `kakebo_cats_inc` | JSON 配列 | 収入カテゴリ一覧 |
| `kakebo_budget` | JSON | 予算設定 `{monthly, alertPct}` |
| `kakebo_initial_balance` | 数値文字列 | 記録開始前の残高（繰越金計算の起点） |

---

## 画面構造（index.html）

```
.frame
├── .dynamic-island
└── .app
    ├── .status-bar              # 時刻・バッテリー表示（モック）
    ├── #screen-input            # 入力画面
    │   ├── .input-header        # 日付・レイアウトボタン
    │   ├── .type-toggle         # 支出 / 収入切替（order:1）
    │   ├── .budget-bar-wrap     # 予算進捗バー（order:2、予算未設定時は非表示）
    │   ├── .amount-wrap         # 金額表示（order:3）
    │   ├── .numpad              # テンキー（order:4）
    │   ├── .cat-wrap            # カテゴリグリッド（order:5）
    │   ├── .memo-hint           # メモ欄（order:6）
    │   └── .hist-wrap           # 直近6件履歴（order:7、スクロール）
    ├── #screen-calendar         # カレンダー画面
    │   ├── .cal-header          # 月ナビゲーション
    │   ├── .weekdays            # 曜日行
    │   ├── .cal-grid            # 日付グリッド
    │   └── .daily-wrap          # 月次サマリー＋取引リスト
    ├── #screen-stats            # 統計画面（txns から動的生成）
    ├── #screen-settings         # 設定画面
    └── .bottom-nav              # タブバー

オーバーレイ（z-index 順）
├── #edit-overlay        # 取引編集（z:450）
├── #cat-mgmt-overlay    # カテゴリ管理（z:400）
├── #cat-edit-overlay    # カテゴリ編集シート（z:500）
├── #budget-edit-overlay # 予算・初期残高入力シート
└── #csv-export-overlay  # CSVエクスポート選択シート
```

### レイアウト切り替えの仕組み

`#screen-input` に `.layout-b` クラスを付与し、CSS `order` プロパティで表示順を変更。DOM 操作ゼロ。

```css
/* Layout A（デフォルト）: 金額→テンキー→カテゴリ→メモ→履歴 */
#screen-input .type-toggle      { order: 1; }
#screen-input .budget-bar-wrap  { order: 2; }
#screen-input .amount-wrap      { order: 3; }
#screen-input .numpad           { order: 4; }
#screen-input .cat-wrap         { order: 5; }
#screen-input .memo-hint        { order: 6; }
#screen-input .hist-wrap        { order: 7; }

/* Layout B: 金額→メモ→履歴→カテゴリ→テンキー */
#screen-input.layout-b .budget-bar-wrap { order: 2; }
#screen-input.layout-b .amount-wrap     { order: 3; }
#screen-input.layout-b .memo-hint       { order: 4; }
#screen-input.layout-b .hist-wrap       { order: 5; }
#screen-input.layout-b .cat-wrap        { order: 6; }
#screen-input.layout-b .numpad          { order: 7; }
```

---

## 主要関数一覧

### データ・永続化

| 関数 | 役割 |
|---|---|
| `todayKey()` | `YYYY-MM-DD` 形式の今日日付を返す |
| `loadTxns()` / `saveTxns()` | 取引データの読み書き |
| `loadCats(type)` / `saveCats()` | カテゴリの読み書き |
| `loadBudget()` / `saveBudget()` | 予算設定の読み書き |
| `loadInitialBalance()` / `saveInitialBalance()` | 初期残高の読み書き |

### 集計・計算

| 関数 | 役割 |
|---|---|
| `getDayTotals(y, m)` | 指定年月の日別集計を txns から生成 |
| `getCarryOver(y, m)` | 指定月の繰越金を `initialBalance + 過去収支` で計算 |
| `getCurrentMonthExp()` | 当月の支出合計を txns から計算 |
| `getLast6Months()` | 直近6ヶ月の `{y, m}` 配列を返す |

### 描画

| 関数 | 役割 |
|---|---|
| `init()` | 起動時の初期描画（全画面） |
| `renderHist()` | 入力画面：直近6件の履歴描画 |
| `histRow(t)` | 取引1件の1行HTML生成（履歴・カレンダー共通） |
| `renderCats()` | 入力画面：カテゴリグリッド描画 |
| `renderBudgetBar()` | 入力画面：予算進捗バー更新 |
| `renderCalendar()` | カレンダーグリッド描画＋サマリー＋日別ビュー |
| `renderMonthSummary()` | 月次サマリーカード（収入・支出・繰越・残高）更新 |
| `renderMonthTxns()` | カレンダー：当月の全取引一覧を表示（デフォルト） |
| `refreshDailyView()` | カレンダー：selDate に応じて月全体 or 日別を再描画 |
| `renderStatsSummary()` | 統計：サマリー・貯蓄率を txns から動的描画 |
| `renderBarChart()` | 統計：直近6ヶ月棒グラフを txns から動的描画 |
| `renderCatBars()` | 統計：当月カテゴリ別支出バーを txns から動的描画 |

### 操作・UI

| 関数 | 役割 |
|---|---|
| `register(name, emoji)` | 取引登録・localStorage 保存・各画面更新 |
| `selectDay(key, day)` | 日タップ：絞り込み表示（同日再タップで月全体に戻る） |
| `openSheet(id)` | 取引編集オーバーレイを開く |
| `saveEdit()` / `deleteAndClose()` | 取引の保存・削除（全画面即時更新） |
| `toggleLayout()` | レイアウト A/B 切り替え・localStorage 保存 |
| `openBudgetEdit(mode)` | 予算シート表示（`'monthly'` / `'alert'` / `'initial'`） |
| `checkBudgetAlert()` | 登録後に予算閾値チェックしてトースト表示 |
| `exportCSV(mode)` | `'month'` or `'all'` で BOM 付き CSV をダウンロード |
| `openCatMgmt()` | カテゴリ管理画面を開く |
| `toast(msg)` | トースト通知を2.2秒表示 |

---

## Service Worker キャッシュ戦略

- **インストール時**：`index.html`・`manifest.json` をキャッシュ
- **フェッチ時**：Cache First（キャッシュあれば返す、なければネットワーク）
- **更新時**：`CACHE` 定数のバージョンを上げてキャッシュを入れ替え

---

## 今後の設計検討事項

| テーマ | 候補 |
|---|---|
| PWA アイコン | SVG を Canvas で PNG 変換 or 手動作成 |
| 固定費自動登録 | 月初に自動で txns に追加するスケジュール処理 |
| データ同期 | iCloud Drive 経由の JSON ファイル共有（iOS Safari の File API） |
| グラフ精度向上 | Canvas API で描画 or Chart.js CDN |
| 年次統計 | 月次統計の年次版。getLast12Months() を追加 |
| 通知（予算超過） | Web Push API（iOS 16.4+ 対応） |
