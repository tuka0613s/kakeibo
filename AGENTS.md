# 爆速家計簿 (Bakusoku Kakeibo) — AI Agent Instructions

A high-speed household account book PWA optimized for rapid expense entry via a custom numeric keypad and one-tap category selection.

## Project Overview

- **Purpose:** Prioritizes input speed for daily expense tracking.
- **Target Platform:** Mobile-first, specifically optimized for iOS Safari (Home Screen PWA).
- **Core Technologies:**
  - **Frontend:** Vanilla HTML, CSS, JavaScript (no build tools).
  - **Architecture:** Single-file application (`index.html` contains all logic, styles, and markup).
  - **Offline Capability:** Service Worker (`sw.js`) with a Cache-First strategy.
  - **Data Persistence:** `localStorage` (key: `kakebo_txns`).
  - **Optional Cloud Sync:** Google Drive API.

## Key Files

| File | Purpose |
|---|---|
| `index.html` | Entire application (HTML + CSS + JS) |
| `sw.js` | Service Worker for offline support |
| `manifest.json` | PWA configuration |
| `SPEC.md` | Functional specifications and screen definitions |
| `DESIGN.md` | Technical architecture, data schemas, function list |
| `PROGRESS.md` | Development status, task list, work log |
| `AGENTS.md` | ← This file. Instructions for all AI agents |

## Running Locally

No build tools required. Use any static file server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Open `http://localhost:8080`.

## Mandatory Rules (apply before every commit)

1. **Update `PROGRESS.md`** on every code change — task states (✅/🔄/⬜) and work log.
2. **Update `SPEC.md`** when adding or changing features/behavior.
3. **Update `DESIGN.md`** when changing data schemas, functions, or file structure.
4. **Bump the version** in `index.html` (settings screen) and `sw.js` (cache key) before `git push`.
5. **Run tests** after every implementation change (`npx playwright test`).
6. **Issue** バグや問題が発生したときは、コード編集を繰り返さない。デバッグログの確認、原因調査用コードや計測用のコードを挿入し、動作ログを確認して原因を特定する。原因特定後し修正完了したあとは、原因調査用コードや、デバッグログ、計測用のコードを削除し、コードを整理してコミットする。
7. **Issue** コマンド実行エラーやその他同じ問題が起こったときは繰り返さないように、AGENTS.mdを更新し繰り返さないようにすること

## Coding Guidelines

- **Single source of truth:** All transactions live in `txns` (localStorage). Never hardcode data.
- **Small functions:** One function = one responsibility.
- **No `prompt()`:** Always use custom bottom sheets for user input.
- **iOS Safari first:** Handle `pointer-events`, `safe-area-inset`, `touch-action`, and `position: fixed` carefully.
- **Versioning:** Increment version in `sw.js` cache key AND `index.html` version display on every push.

## Documentation Rules

- Task states and work logs → **`PROGRESS.md` only**
- Do NOT put progress/todos in `README.md`, `SPEC.md`, or `DESIGN.md`

## Prohibited

- Using `prompt()` anywhere
- Hardcoding dates or amounts
- Putting development progress in README/SPEC/DESIGN
