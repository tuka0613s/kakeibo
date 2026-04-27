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
├── icon-192.png    # PWA アイコン（要生成）
├── icon-512.png    # PWA アイコン（要生成）
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

### Category（カテゴリ）※将来 localStorage 管理予定

```json
{
  "id":    "c1",
  "name":  "食費",
  "emoji": "🍜",
  "type":  "expense" | "income" | "both",
  "order": 0
}
```

### Budget（予算）※未実装

```json
{
  "monthly": 200000,
  "alertPct": 80,
  "byCat": { "食費": 30000 }
}
```

### CarryOver（繰越金）※将来は txns から自動計算予定

```json
{
  "2026-4": 450000,
  "2026-3": 298000
}
```

---

## localStorage キー一覧

| キー | 型 | 内容 |
|---|---|---|
| `kakebo_txns` | JSON 配列 | 全取引データ |
| `kakebo_next_id` | 数値文字列 | 次の取引 ID |
| `kakebo_layout` | `"A"` or `"B"` | 入力画面レイアウト |
| `kakebo_cats_exp` | JSON 配列 | 支出カテゴリ一覧（将来） |
| `kakebo_cats_inc` | JSON 配列 | 収入カテゴリ一覧（将来） |
| `kakebo_budget` | JSON | 予算設定 `{monthly, alertPct}` |
| `kakebo_carry` | JSON | 繰越金マップ（将来） |

---

## 画面構造（index.html）

```
.app
├── .status-bar          # 時刻・バッテリー表示（モック）
├── #screen-input        # 入力画面
│   ├── .input-header    # 日付・レイアウトボタン・メニュー
│   ├── .type-toggle     # 支出 / 収入切替
│   ├── .amount-wrap     # 金額表示（order で位置制御）
│   ├── .numpad          # テンキー（order で位置制御）
│   ├── .cat-wrap        # カテゴリグリッド（order で位置制御）
│   ├── .memo-hint       # メモ欄（order で位置制御）
│   └── .hist-wrap       # 直近履歴（flex:1 でスクロール）
├── #screen-calendar     # カレンダー画面
├── #screen-stats        # 統計画面
├── #screen-settings     # 設定画面
└── .bottom-nav          # タブバー
```

### レイアウト切り替えの仕組み

`#screen-input` に `.layout-b` クラスを付与し、CSS `order` プロパティで各ブロックの表示順を変更。DOM 操作ゼロ・アニメーション不要。

```css
/* Layout A (default) */
#screen-input .amount-wrap { order: 2; }
#screen-input .numpad      { order: 3; }
#screen-input .cat-wrap    { order: 4; }
#screen-input .memo-hint   { order: 5; }
#screen-input .hist-wrap   { order: 6; }

/* Layout B */
#screen-input.layout-b .memo-hint { order: 3; }
#screen-input.layout-b .hist-wrap { order: 4; }
#screen-input.layout-b .cat-wrap  { order: 5; }
#screen-input.layout-b .numpad    { order: 6; }
```

---

## 主要関数一覧

| 関数 | 役割 |
|---|---|
| `init()` | 起動時の初期描画 |
| `register(name, emoji)` | 取引登録・localStorage 保存 |
| `renderHist()` | 直近6件の履歴描画 |
| `renderCats()` | カテゴリグリッド描画 |
| `getDayTotals(y, m)` | 指定年月の日別集計（txns から動的生成） |
| `renderCalendar()` | カレンダーグリッド描画 |
| `renderMonthSummary()` | 月次サマリーカード更新 |
| `selectDay(key, day)` | 日別詳細表示 |
| `toggleLayout()` | レイアウト A/B 切り替え |
| `saveTxns()` | txns を localStorage に保存 |
| `todayKey()` | `YYYY-MM-DD` 形式の今日日付を返す |
| `histRow(t)` | 取引1件の1行HTML生成（履歴・日別詳細共通） |
| `renderBudgetBar()` | 入力画面の予算進捗バーを更新 |
| `checkBudgetAlert()` | 登録後に予算閾値チェックしてトースト表示 |
| `openBudgetEdit(mode)` | 予算シート表示（'monthly' or 'alert'） |
| `getCurrentMonthExp()` | 当月の支出合計を txns から計算 |

---

## Service Worker キャッシュ戦略

- **インストール時**：`index.html`・`manifest.json` をキャッシュ
- **フェッチ時**：Cache First（キャッシュあれば返す、なければネットワーク）
- **更新時**：`CACHE` 定数のバージョンを上げてキャッシュを入れ替え

---

## 今後の設計検討事項

| テーマ | 候補 |
|---|---|
| データ同期 | iCloud Drive 経由の JSON ファイル共有（iOS Safari の File API） |
| グラフ | Canvas API で描画 or Chart.js CDN 読み込み |
| カテゴリ並び替え | HTML5 Drag & Drop API |
| 通知（予算超過） | Web Push API（iOS 16.4+ 対応） |
