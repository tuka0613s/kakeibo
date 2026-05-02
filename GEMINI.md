# Project: 爆速家計簿 (Bakusoku Kakeibo)

A high-speed household account book PWA (Progressive Web App) optimized for rapid entry via a custom numeric keypad and one-tap category selection.

## Project Overview

-   **Purpose:** Prioritizes input speed for daily expense tracking.
-   **Target Platform:** Mobile-first, specifically optimized for iOS Safari (Home Screen PWA).
-   **Core Technologies:**
    -   **Frontend:** Vanilla HTML, CSS, and JavaScript.
    -   **Architecture:** Single-file application (`index.html` contains all logic, styles, and markup).
    -   **Offline Capability:** Service Worker (`sw.js`) with a Cache-First strategy.
    -   **Data Persistence:** `localStorage` (key: `kakebo_txns`).
    -   **Optional Cloud Sync:** Google Drive API (planned/partially implemented).


## Rule
- ドキュメントはファイル、仕様変更、設計変更のたびに更新すること
- gitにコミット前にはドキュメントの更新忘れがないか確認し未更新分を更新し、versionを変更してからコミットすること
- CLAUDE.md,GEMINI.md両方を常に参照すること

## Building and Running

Since this project uses no build tools, it can be run using any local static file server.

-   **Python:** `python -m http.server 8080`
-   **Node.js:** `npx serve .`
-   **Access:** Open `http://localhost:8080` in a browser.

## Development Conventions

### Documentation & Process
-   **Mandatory Updates:** Every code change must be logged in `PROGRESS.md`.
-   **Spec & Design:** Functional changes require updating `SPEC.md`. Structural or data schema changes require updating `DESIGN.md`.
-   **Task Management:** All task states (✅/🔄/⬜) and logs must stay in `PROGRESS.md`. Do not include these in README, SPEC, or DESIGN files.

### Coding Guidelines
-   **Functions:** Keep functions small and focused on a single responsibility.
-   **UI/UX:**
    -   Avoid `prompt()`; use custom bottom sheets or input views.
    -   Prioritize iOS Safari PWA behavior (handle `pointer-events` and `safe-area-inset` correctly).
-   **Data:** `txns` in `localStorage` is the single source of truth for transactions.
-   **Versioning:** Increment the version number in `sw.js` and `index.html` when pushing significant changes.
-   **test by mcp playwright.

## Key Files

-   `index.html`: The entire application (HTML, CSS, JS).
-   `sw.js`: Service Worker for offline support and caching.
-   `manifest.json`: PWA configuration.
-   `SPEC.md`: Detailed functional specifications and screen definitions.
-   `DESIGN.md`: Technical architecture, data schemas (localStorage keys), and function lists.
-   `PROGRESS.md`: Current development status, task list, and historical work log.
-   `CLAUDE.md`: Specific instructions for AI agents regarding coding style and workflow.

## Future Plans
-   PWA Icon generation.
-   Recurring expense automation.
-   JSON backup/restore.
-   Google Drive / iCloud synchronization.
