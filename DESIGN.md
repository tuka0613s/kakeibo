# 爆速家計簿 技術設計書

## 技術スタック

| レイヤ | 採用技術 | 理由 |
|---|---|---|
| UI | HTML / CSS / Vanilla JS | ビルド不要・Mac なしで即動作 |
| オフライン | Service Worker（Cache First） | PWA 必須要件 |
| データ（ローカル） | localStorage | シンプル・iOS Safari 対応 |
| データ（クラウド） | Google Drive API v3 + GIS Token Client | 無料・OAuth 2.0・appDataFolder |
| 配布 | PWA + GitHub Pages | App Store 不要・Mac 不要 |

**公開URL：** https://tuka0613s.github.io/kakeibo/  
**リポジトリ：** https://github.com/tuka0613s/kakeibo

---

## ファイル構成

```
kakeibo/
├── index.html       # アプリ本体（CSS・JS すべて内包）
├── manifest.json    # PWA マニフェスト
├── sw.js            # Service Worker（現バージョン: kakebo-v14）
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
| `kakebo_layout` | `"A"` or `"B"` | 入力画面レイアウト（テンキー上/下） |
| `kakebo_npad` | `"phone"` or `"calc"` | テンキー 0 キー位置（右端/9の下） |
| `kakebo_cats_exp` | JSON 配列 | 支出カテゴリ一覧 |
| `kakebo_cats_inc` | JSON 配列 | 収入カテゴリ一覧 |
| `kakebo_budget` | JSON | 予算設定 `{monthly, alertPct}` |
| `kakebo_initial_balance` | 数値文字列 | 記録開始前の残高（繰越金計算の起点） |
| `kakebo_updated_at` | ISO 文字列 | データ最終更新日時（txns/cats/budget/balance 変更時に更新） |
| `gdrive_client_id` | 文字列 | Google OAuth クライアントID（ユーザー入力） |
| `gdrive_token` | JSON | GIS から取得したアクセストークン `{token, expiry}` |
| `gdrive_file_id` | 文字列 | Drive 上の `kakeibo-data.json` のファイルID（初回作成後に保存） |
| `gdrive_last_sync_at` | ISO 文字列 | Drive への最終アップロード成功日時（起動時チェックの基準） |

---

## 画面構造（index.html）

```
.frame  ← モバイルは全画面・デスクトップ(600px+)はiPhone17モックフレーム
├── .dynamic-island  ← デスクトップのみ表示
└── .app
    ├── .status-bar       ← デスクトップのみ表示（モック：9:41 ●●●）
    ├── #screen-input     # 入力画面
    │   ├── .input-header
    │   │   ├── #input-date-label (dynamic date)
    │   │   └── #input-date-sub   (dynamic day of week)
    │   ├── .type-toggle      (order: 1)
    │   ├── .budget-bar-wrap  (order: 2)  ← 予算未設定時は非表示
    │   ├── .amount-wrap      (order: 3)
    │   ├── .numpad           (order: 4)
    │   ├── .cat-wrap         (order: 5)
    │   │   └── .cat-grid (max-height: 222px, overflow-y: auto)
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
├── #edit-overlay        (z: 410)  取引編集・カスタムテンキー内蔵（ヘッダー：キャンセル、フッター：削除／保存）
├── #cat-edit-overlay    (z: 500)  カテゴリ追加・編集シート
├── #budget-edit-overlay           予算・初期残高入力（3モード共用）
├── #csv-export-overlay            CSV エクスポート / インポート選択シート
├── #gdrive-sheet-overlay          Google Drive 同期シート（接続・同期・読み込み）
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

### モバイル / iPad / デスクトップ切り替えの仕組み

デフォルト（モバイル）でフルスクリーン。ブレークポイントで3段階に切り替え。

```
< 768px          : iPhone（全画面）
768px〜1366px    : iPad（全画面・モックフレームなし）
  900px〜1366px  :   └ 横向きは max-width:720px 中央寄せ
≥ 1367px         : デスクトップ（iPhone モックフレーム）
```

```css
/* デフォルト：全画面（iPhone） */
.frame { width: 100%; height: 100dvh; }
.dynamic-island { display: none; }
.status-bar     { display: none; }
.bottom-nav { height: calc(56px + env(safe-area-inset-bottom)); }

/* デスクトップ：iPhone モックフレーム */
@media (min-width: 600px) {
  .frame { width: 393px; height: 852px; border-radius: 54px; }
  .dynamic-island { display: block; }
  .status-bar { display: flex; }
  .bottom-nav { height: 83px; }
}

/* iPad（768〜1366px）：モックフレームをキャンセルして全画面に戻す */
@media (min-width: 768px) and (max-width: 1366px) {
  body { background: var(--bg); display: block; }
  .frame { width: 100%; height: 100dvh; border-radius: 0; box-shadow: none; }
  .dynamic-island { display: none; }
  .status-bar { display: none; }
  .bottom-nav { height: calc(56px + env(safe-area-inset-bottom)); }
}

/* iPad 横向き（900px+）：中央寄せ */
@media (min-width: 900px) and (max-width: 1366px) {
  .frame { max-width: 720px; margin: 0 auto; }
}

/* iPhone 横向きロック（max-width:932px かつ landscape） */
@media (orientation: landscape) and (max-width: 932px) {
  .rotate-overlay { display: flex; }
}
```

`.rotate-overlay` は半透明（`rgba + backdrop-filter: blur`）で後ろのコンテンツが透けて見える。iPad 横向き（1180px）は `max-width: 932px` に該当しないためオーバーレイは表示されない。

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
| `init()` | 起動時の初期描画（全画面）・ブラウザモード判定・renderInputDate 呼出し |
| `renderInputDate()` | 入力画面のヘッダー日付と曜日を現在の日時で更新 |
| `renderHist()` | 入力画面：直近4件の履歴描画 |
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
| `applyNumpadStyle()` | 0キー位置（右/下）を DOM に反映 |
| `toggleNumpadStyle()` | 0キー位置トグル・localStorage 保存 |
| `nk(v)` | 数字/ピリオド入力 |
| `nk00()` | 00 ショートカット（calcモード時のみ呼ばれる） |
| `nkOp(op)` | 演算子（`'+'` or `'-'`）を設定。第1オペランドを記憶して入力クリア |
| `nkEq()` | 演算を実行して結果を `amtStr` に反映。カテゴリタップ時も自動呼出し |
| `editNk(v)` / `editNk00()` / `editNkOp(op)` / `editNkEq()` | 編集画面の同等関数 |
| `editBack()` / `editClearAmt()` | 編集用削除操作 |
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

### Google Drive 同期

| 関数 | 役割 |
|---|---|
| `gdriveSyncDebounced()` | `saveTxns()` 呼び出し後に3秒 debounce で `gdriveUpload()` を予約 |
| `gdriveUpload()` | 全データを Drive の JSON ファイルに保存。成功時に `gdrive_last_sync_at` を更新 |
| `gdriveDownload()` | Drive の JSON ファイルを読み込み・ローカルデータを上書きして全画面再描画 |
| `gdriveConnect()` | GIS Token Client でポップアップ認証。トークンを localStorage に保存 |
| `_getValidToken()` | 有効なトークンを返す。期限切れ時は `prompt:''` でサイレントリフレッシュ |
| `gdriveSync()` | 双方向同期. Drive と local の `updatedAt` を比較し、新しい方に自動で合わせる（Drive 新→ダウンロード / Local 新→アップロード / 同→通知） |
| `_applyDriveData(data)` | Drive から取得した JSON をローカルに反映する共通処理。`_gdriveAutoLoad` / `gdriveDownload` / `gdriveSync` から呼ばれる |
| `_gdriveAutoLoad()` | 接続直後に Drive の中身を取得してタイムスタンプ比較。Drive 空＋ローカルあり→アップロード / ローカル空＋Drive あり→ダウンロード / 両方あり→タイムスタンプで自動判定 |
| `_gdriveStartupCheck()` | 起動3秒後に Drive の `modifiedTime` を軽量チェック。`gdrive_last_sync_at` より新しければトースト通知 |
| `showDriveConflictSheet(driveCnt)` | 強制読み込み確認シートを表示。Drive 件数とローカル件数を並記（バックアップして読み込む / そのまま読み込む / キャンセル） |
| `downloadBackupJSON()` | 現在の全データを `kakeibo-backup-日時.json` としてダウンロード |
| `gdriveDisconnect()` | トークン失効・localStorage クリア・UI リセット |
| `openGdriveSheet()` / `closeGdriveSheet()` | Google Drive シートの開閉 |
| `renderGdriveSheet()` | 接続状態に応じてシート内 UI を動的描画 |
| `renderGdriveStatusLbl()` | 設定画面の「接続済み（N分）」ラベルを更新 |

#### Drive データ形式

```json
{
  "version": 1,
  "updatedAt": "2026-04-28T12:00:00.000Z",
  "txns": [...],
  "nextId": 123,
  "expCats": [...],
  "incCats": [...],
  "budget": { "monthly": 200000, "alertPct": 80 },
  "initialBalance": 0
}
```

ファイルは `appDataFolder`（ユーザーの Drive に表示されない隠し領域）の `kakeibo-data.json` 1ファイルのみ。

### 統計 State

| 変数 | 初期値 | 役割 |
|---|---|---|
| `statsPeriod` | `'monthly'` | 現在の期間モード（`'monthly'` or `'yearly'`） |
| `statsYear` | 今年 | 統計で表示中の年 |
| `statsMonth` | 今月 | 統計で表示中の月（月次モードで使用） |
| `catDetailName` | `''` | カテゴリ詳細で表示中のカテゴリ名 |
| `catDetailEmoji` | `''` | カテゴリ詳細で表示中の絵文字 |
| `catDetailSort` | `'date'` | カテゴリ詳細の取引ソート順（`'date'` or `'amt'`） |

### テンキー State

| 変数 | 初期値 | 役割 |
|---|---|---|
| `amtStr` | `''` | 入力中の金額文字列（桁数上限10） |
| `calcFirstOperand` | `null` | 演算の第1オペランド（`null` = 演算なし） |
| `calcOp` | `null` | 演算子（`null` / `'+'` / `'-'`） |
| `numpadCalc` | localStorage より復元 | テンキーの0キー位置（`false`=右端 / `true`=9の下） |
| `editAmtStr` | `''` | 編集画面の入力中金額文字列 |
| `editCalcFirstOperand` | `null` | 編集画面の演算第1オペランド |
| `editCalcOp` | `null` | 編集画面の演算子 |

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
| kakebo-v6 | テンキー0キー位置切替・000・演算キー（−/+/=）・ダブルタップ拡大防止・右端スワイプ防止 |
| kakebo-v7 | Google Drive 同期機能追加（GIS Token Client・appDataFolder） |
| kakebo-v8 | iPad 11インチ対応（768〜1366px フルスクリーン）・iPhone 横向きオーバーレイ（半透明blur）・Drive 同期バグ修正（Drive空→自動アップロード・競合シートに件数表示） |
| kakebo-v9 | Drive「同期」と「バックアップ（保存）」を分離。`gdriveSync()` 追加（updatedAt 比較の双方向同期）。`_applyDriveData()` 共通化。接続直後にタイムスタンプ比較で自動判定。各操作のFBメッセージを状況・件数付きに改善 |
| kakebo-v14 | 入力画面の日付動的化、カテゴリグリッドのスクロール閾値調整（4行/3行）、メモ/日付欄のデザイン統一、テンキー設定の編集画面同期 |
| kakebo-v13 | 取引編集画面・スクロールエリアの動作安定化（overscroll-behavior, touch-action） |
| kakebo-v11 | テンキー 00 統一。取引編集画面のカテゴリ一覧にスクロール導入。アクションボタンをフッターに固定 |
| kakebo-v10 | テンキー 000 → 00 変更。取引編集 UI 整理。画面ズレ防止 CSS 追加 |

キャッシュ戦略：Cache First（キャッシュあれば返す・なければネットワーク）  
更新時：`CACHE` 定数のバージョンを上げると古いキャッシュを自動削除。  
手動更新：設定 → アプリ情報 → アップデートを確認・強制更新 ボタンで即時クリア可能。

---

## 既知の制約・リスク

| 項目 | 内容 |
|---|---|
| iPhone 横向きロック | iOS Safari は `screen.orientation.lock()` 非対応のため Web からは回転を完全に防ぐことができない。PWA の `manifest.json` に `"orientation": "portrait"` を設定済みだが iOS バージョンによっては無視される場合がある。横向き時は半透明オーバーレイで「縦向きにしてください」を表示して代替 |
| Drive 同期：競合キャンセル後の自動アップロード | 競合確認シートを「キャンセル」で閉じた後にローカルで取引を登録すると、`saveTxns()` → 3秒後の `gdriveUpload()` が走り Drive の既存データを上書きする。競合未解決のまま自動アップロードを止めるフラグは未実装 |
