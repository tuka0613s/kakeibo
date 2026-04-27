# 爆速家計簿 技術設計書

## 技術スタック

| レイヤ | 採用技術 | 理由 |
|---|---|---|
| UI | HTML / CSS / Vanilla JS | ビルド不要・Mac なしで即動作 |
| オフライン | Service Worker（Cache First） | PWA 必須要件 |
| データ | localStorage | シンプル・iOS Safari 対応 |
| 配布 | PWA + GitHub Pages | App Store 不要・Mac 不要 |

**公開URL：** https://tuka0613s.github.io/kakeibo/  
**リポジトリ：** https://github.com/tuka0613s/kakeibo

---

## ファイル構成

```
kakeibo/
├── index.html       # アプリ本体（CSS・JS すべて内包）
├── manifest.json    # PWA マニフェスト
├── sw.js            # Service Worker（現バージョン: kakebo-v5）
├── icon-192.png     # PWA アイコン ※未生成
├── icon-512.png     # PWA アイコン ※未生成
├── README.md        # プロジェクト概要・インストール手順
├── CLAUDE.md        # Claude への開発指示（このプロジェクト固有ルール）
├── SPEC.md          # 機能仕様書
├── DESIGN.md        # 技術設計書（本ファイル）
└── PROGRESS.md      # 開発進捗
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
{ "id": "e1", "name": "食費", "emoji": "🍜" }
```

支出・収入それぞれ別配列で管理（`kakebo_cats_exp` / `kakebo_cats_inc`）。

### Budget（予算）

```json
{ "monthly": 200000, "alertPct": 80 }
```

### 繰越金

ハードコードマップは廃止。`getCarryOver(y, m)` が動的に計算する。

```
繰越金(y月) = initialBalance + Σ(y月より前の全取引の収支)
```

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
.frame  ← モバイルは全画面・デスクトップ(600px+)はiPhone17モックフレーム
├── .dynamic-island  ← デスクトップのみ表示
└── .app
    ├── .status-bar       ← デスクトップのみ表示（モック：9:41 ●●●）
    ├── #screen-input     # 入力画面
    │   ├── .input-header
    │   ├── .type-toggle      (order: 1)
    │   ├── .budget-bar-wrap  (order: 2)  ← 予算未設定時は非表示
    │   ├── .amount-wrap      (order: 3)
    │   ├── .numpad           (order: 4)
    │   ├── .cat-wrap         (order: 5)
    │   ├── .memo-hint        (order: 6)
    │   └── .hist-wrap        (order: 7)  ← スクロール
    ├── #screen-calendar  # カレンダー画面
    │   ├── .cal-header
    │   ├── .weekdays
    │   ├── .cal-grid
    │   └── .daily-wrap   ← 月次サマリー + 取引リスト
    ├── #screen-stats     # 統計画面（txns から動的生成）
    │   ├── .stats-header
    │   │   ├── .period-row       ← 月次/年次切替ボタン
    │   │   ├── #stats-month-nav  ← 月次モード時のみ表示（年月ナビ）
    │   │   └── #stats-year-nav   ← 年次モード時のみ表示（年ナビ）
    │   └── .stats-scroll
    ├── #screen-settings  # 設定画面
    └── .bottom-nav       ← Safe Area 対応（env(safe-area-inset-bottom)）
                             アクティブタブ: インジケーターライン + アイコン拡大 + ラベル太字

オーバーレイ（z-index 順）
├── #cat-mgmt-overlay    (z: 400)  カテゴリ管理
├── #cat-detail-overlay  (z: 405)  統計カテゴリ詳細（推移グラフ＋取引履歴）
├── #edit-overlay        (z: 410)  取引編集・カスタムテンキー内蔵
├── #cat-edit-overlay    (z: 500)  カテゴリ追加・編集シート
├── #budget-edit-overlay           予算・初期残高入力（3モード共用）
├── #csv-export-overlay            CSV エクスポート / インポート選択シート
├── #memo-sheet-overlay            メモ入力シート（prompt() の代替）
└── #confirm-overlay               汎用確認シート（sa-danger ボタン＋コールバック）
```

### レイアウト切り替えの仕組み

`#screen-input` に `.layout-b` クラスを付与し、CSS `order` で表示順を変更。DOM 操作ゼロ。

```css
/* Layout B 時の上書き */
#screen-input.layout-b .memo-hint  { order: 4; }
#screen-input.layout-b .hist-wrap  { order: 5; }
#screen-input.layout-b .cat-wrap   { order: 6; }
#screen-input.layout-b .numpad     { order: 7; }

/* ブラウザモード（非PWA）: hist-wrap の min-height を解除してテンキーを常時表示 */
body.browser-mode #screen-input.layout-b .hist-wrap { min-height: 0; }
```

ブラウザモード判定は `init()` 内で行い、`body.browser-mode` クラスを付与する。

```js
if (!(navigator.standalone || matchMedia('(display-mode: standalone)').matches)) {
  document.body.classList.add('browser-mode');
}
```

### モバイル / デスクトップ切り替えの仕組み

デフォルト（モバイル）でフルスクリーン。`min-width: 600px` の時だけモックフレームに切り替え。

```css
/* デフォルト：全画面（モバイル・PWA） */
.frame { width: 100%; height: 100dvh; border-radius: 0; }
.dynamic-island { display: none; }
.status-bar     { display: none; }
.bottom-nav { height: calc(56px + env(safe-area-inset-bottom)); }

/* デスクトップのみモックフレーム */
@media (min-width: 600px) {
  .frame { width: 393px; height: 852px; border-radius: 54px; }
  .dynamic-island { display: block; }
  .status-bar     { display: flex; }
  .bottom-nav { height: 83px; }
}
```

---

## 主要関数一覧

### データ・永続化

| 関数 | 役割 |
|---|---|
| `todayKey()` | `YYYY-MM-DD` 形式の今日日付を返す |
| `loadTxns()` / `saveTxns()` | 取引データの読み書き（初期値は空配列） |
| `loadCats(type)` / `saveCats()` | カテゴリの読み書き |
| `loadBudget()` / `saveBudget()` | 予算設定の読み書き |
| `loadInitialBalance()` / `saveInitialBalance()` | 初期残高の読み書き |

### 集計・計算

| 関数 | 役割 |
|---|---|
| `getDayTotals(y, m)` | 指定年月の日別集計を txns から生成 |
| `getCarryOver(y, m)` | 指定月の繰越金を `initialBalance + 過去収支` で計算 |
| `getCurrentMonthExp()` | 当月の支出合計を txns から計算 |
| `getLast6Months()` | 今月を末尾とした直近6ヶ月の `{y, m}` 配列を返す |
| `getMonthRange(refY, refM, count)` | `refY/refM` を末尾とした `count` ヶ月分の `{y, m}` 配列を返す |

### 描画

| 関数 | 役割 |
|---|---|
| `init()` | 起動時の初期描画（全画面）・ブラウザモード判定 |
| `renderHist()` | 入力画面：直近6件の履歴描画 |
| `histRow(t)` | 取引1件の1行HTML生成（履歴・カレンダー・カテゴリ詳細で共通使用） |
| `renderCats()` | 入力画面：カテゴリグリッド描画 |
| `renderBudgetBar()` | 入力画面：予算進捗バー更新 |
| `renderCalendar()` | カレンダーグリッド＋サマリー＋日別ビューを描画 |
| `renderMonthSummary()` | 月次サマリーカード（収入・支出・繰越・残高）更新 |
| `renderMonthTxns()` | カレンダー：当月の全取引一覧を表示（デフォルト） |
| `refreshDailyView()` | カレンダー：selDate に応じて月全体 or 日別を再描画 |
| `renderStatsSummary()` | 統計：サマリー・貯蓄率を `statsYear/statsMonth` で動的描画 |
| `renderBarChart()` | 統計：棒グラフを月次/年次モードに応じて描画 |
| `renderCatBars()` | 統計：カテゴリ別支出バーを月次/年次モードに応じて描画（最大8件・タップで詳細へ） |
| `renderCatDetail()` | カテゴリ詳細：推移グラフ・サマリー・取引履歴を描画 |

### 操作・UI

| 関数 | 役割 |
|---|---|
| `register(name, emoji)` | 取引登録・localStorage 保存・各画面更新 |
| `selectDay(key, day)` | 日タップ：絞り込み（同日再タップで月全体に戻る） |
| `openSheet(id)` | 取引編集オーバーレイを開く |
| `saveEdit()` / `deleteAndClose()` | 取引の保存・削除（全画面即時更新） |
| `toggleLayout()` | レイアウト A/B 切り替え・localStorage 保存 |
| `switchTab(tab)` | タブ切り替え。calendar/stats タブは切替時に再描画 |
| `openBudgetEdit(mode)` | 予算シート（`'monthly'` / `'alert'` / `'initial'` の3モード共用） |
| `checkBudgetAlert()` | 登録後に予算閾値チェックしてトースト表示 |
| `exportCSV(mode)` | `'month'` or `'all'` で BOM 付き CSV をダウンロード |
| `triggerCSVImport()` | hidden file input をクリックして CSV ファイル選択を起動 |
| `importCSV(event)` | 選択 CSV を読み込み・パースして txns に追記 |
| `parseCSVLine(line)` | CSV 1行をクォート対応でフィールド分割 |
| `openCatMgmt()` | カテゴリ管理画面を開く |
| `editMemo()` | メモシートを開く（`#memo-sheet-overlay`）・`input.focus()` で即キーボード表示 |
| `saveMemoSheet()` | メモシートの値を `curMemo` に反映して閉じる |
| `setPeriod(btn, period)` | 統計の月次/年次切り替え。ナビ表示・全グラフ更新 |
| `navigateStatsMonth(dir)` | 統計の選択月を前後に移動（年跨ぎ対応） |
| `navigateStatsYear(dir)` | 統計の選択年を前後に移動 |
| `_updateStatsNav()` | 月次/年次ナビ行の表示切替とラベル更新 |
| `openCatDetail(el)` | カテゴリ詳細オーバーレイを開く（`data-cat` / `data-emoji` 属性から取得）・ソートをリセット |
| `closeCatDetail()` | カテゴリ詳細オーバーレイを閉じる |
| `setCatSort(sort)` | カテゴリ詳細のソート順切替（`'date'` or `'amt'`）・再描画 |
| `confirmLoadDemo()` | 既存データがあれば確認シート経由、なければ即デモデータ登録 |
| `loadDemoData()` | SEED_TXNS を txns に設定して localStorage 保存・描画更新 |
| `confirmClearAll()` | 確認シートを経由して全データ消去 |
| `clearAllData()` | txns・nextId をリセットして全画面更新 |
| `showConfirm(title, body, onOK)` | 汎用確認シートを開く。OK 押下で `onOK` コールバックを実行 |
| `forceUpdate()` | 確認シート経由でキャッシュ削除 → SW解除 → 強制リロード |
| `toast(msg)` | トースト通知を2.2秒表示 |

### 統計 State

| 変数 | 初期値 | 役割 |
|---|---|---|
| `statsPeriod` | `'monthly'` | 現在の期間モード（`'monthly'` or `'yearly'`） |
| `statsYear` | 今年 | 統計で表示中の年 |
| `statsMonth` | 今月 | 統計で表示中の月（月次モードで使用） |
| `catDetailName` | `''` | カテゴリ詳細で表示中のカテゴリ名 |
| `catDetailEmoji` | `''` | カテゴリ詳細で表示中の絵文字 |
| `catDetailSort` | `'date'` | カテゴリ詳細の取引ソート順（`'date'` or `'amt'`） |

---

## デモデータ

`SEED_TXNS` は IIFE で動的生成する。2024年1月〜2026年4月の約400件。

```js
const SEED_TXNS = (() => {
  // 月ごとに給与・家賃・光熱費・食費・外食・通信費などを生成
  // 冬月はガス代追加、4月/10月はボーナス収入
})();
```

---

## Service Worker

| バージョン | 変更内容 |
|---|---|
| kakebo-v1 | 初期版（絶対パス） |
| kakebo-v2 | GitHub Pages 対応（相対パスに変更） |
| kakebo-v3 | モバイル全画面対応に伴うキャッシュ更新 |
| kakebo-v4 | 強制更新機能追加・各種バグ修正に伴うキャッシュ更新 |
| kakebo-v5 | 統計ナビ大型化・CSVインポート・カテゴリ詳細ソート・未実装メニュー無効化 |

キャッシュ戦略：Cache First（キャッシュあれば返す・なければネットワーク）  
更新時：`CACHE` 定数のバージョンを上げると古いキャッシュを自動削除。  
手動更新：設定 → アプリ情報 → アップデートを確認・強制更新 ボタンで即時クリア可能。
