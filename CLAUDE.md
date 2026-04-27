# 爆速家計簿 — Claude への開発指示

## 必須：コード変更のたびに行うこと

コードを1行でも変更したら、以下を必ず更新する。

| ファイル | 更新タイミング |
|---|---|
| `PROGRESS.md` | **毎回**。タスク状態（✅/🔄/⬜）と作業ログを更新 |
| `SPEC.md` | 機能追加・仕様変更があるとき |
| `DESIGN.md` | データ構造・関数・ファイル構成が変わるとき |

## 開発の進め方

- `PROGRESS.md` のフェーズ3タスクを上から順に消化する
- 次の優先順位：B）月次予算+アラート → C）PWAアイコン → D）CSVエクスポート
- 実装前に「何をどう変えるか」を1文で宣言してから手を動かす

## コーディング方針

- データの単一ソース：取引は `txns`（localStorage）のみ。ハードコードしない
- 関数は小さく。1関数1責務
- `prompt()` は使わない。必ず専用の入力シートを作る
- iOS Safari PWA で動くことを最優先。`pointer-events` / safe-area に注意
- アプリのバージョンはgit pushのタイミングで変更すること

## ファイル構成（変えない）

```
index.html   # アプリ本体（CSS・JS 内包）
manifest.json
sw.js
CLAUDE.md    # ← このファイル（Claude への指示）
SPEC.md      # 機能仕様書
DESIGN.md    # 技術設計書
PROGRESS.md  # 開発進捗
README.md    ♯ Github公開用の情報を記載
```

## 禁止事項
README.md,SPEC.md,DESIGN.md に進捗や今後の課題、残作業を含めないこと。それらはPROGRESS.md にまとめて記載すること
