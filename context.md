# Trading Journal Plugin — Project Context

## Overview

A local-first Obsidian plugin that turns your daily trading notes into a full analytics dashboard. Trades are logged directly as markdown tables inside your daily notes — no external tools, no imports, no sync. Everything lives in your vault.

The plugin reads those tables, matches entries to exits, calculates P&L and statistics, and renders an interactive dashboard with charts, filters, drill-downs, expandable graphics, and a Market Monitor tab — all inside Obsidian.

---

## Vault Structure

```
Master/
  Journal/
    2026/
      03/
        2026-03-17-Monday.md     ← daily note (contains trade table)
        2026-03-18-Tuesday.md
  Accounts.md                    ← account balances, deposits, withdrawals
  .trading-journal-cache.json    ← auto-generated cache (do not edit)
Market Data.md                   ← manual market monitor table used by the Market Monitor tab
```

---

## Trade Table Format

Every daily note can contain a trade table. The plugin finds it by looking for the `trade_id` column header anywhere in the file.

```markdown
| trade_id | symbol | type  | dir  | price  | size | fees | time  | strategy | score | target_sl | mistakes | note | account |
| -------- | ------ | ----- | ---- | ------ | ---- | ---- | ----- | -------- | ----- | --------- | -------- | ---- | ------- |
| T001     | AAPL   | entry | long | 185.50 | 100  | 1.50 | 09:35 | momentum | 45    | 183.00    |          |      | IBKR-1  |
| T001     | AAPL   | exit  |      | 188.00 | 60   | 0.90 | 11:00 | momentum |       |           |          |      | IBKR-1  |
| T001     | AAPL   | exit  |      | 190.00 | 40   | 0.60 | 14:30 | momentum |       |           |          |      | IBKR-1  |
```

**Column rules:**

- `type` — `entry` or `exit`
- `dir`, `strategy`, `score`, `target_sl` — only required on entry rows; leave empty on exits
- `score` — your trade setup rating (0–55), determines grade A/B/C/D
- `target_sl` — your planned stop loss price (used to calculate R multiple)
- `mistakes` — comma-separated tags e.g. `early-entry,moved-sl`
- Partial exits are supported — multiple exit rows with the same `trade_id`
- Exit rows with empty `dir`/`strategy`/`score`/`target_sl` inherit from the entry

**Grading system:**

| Score | Grade | Max Risk   |
| ----- | ----- | ---------- |
| 40–55 | A     | 1–2%       |
| 30–39 | B     | 0.25–0.75% |
| 15–29 | C     | <0.25%     |
| <15   | D     | No trade   |

---

## Accounts.md Format

```markdown
| account | date       | type       | amount | note             |
| ------- | ---------- | ---------- | ------ | ---------------- |
| IBKR-1  | 2026-01-01 | initial    | 50000  | Starting balance |
| IBKR-1  | 2026-03-15 | deposit    | 10000  | Added funds      |
| IBKR-1  | 2026-04-01 | withdrawal | 5000   |                  |
```

---

## Market Conditions Score

The daily note frontmatter `score` field (written automatically by a Dataview JS block) represents the market conditions score (0–100). The plugin reads this to populate the **Market Conditions vs P&L** correlation chart. It strips emoji prefixes (e.g. `●30` → `30`) before parsing.

---

## Partial Exit Logic

When a trade has multiple exit rows:

- One `Trade` record is created **per exit row** so each appears on its own exit date in the calendar and daily P&L
- Multi-exit trades are labelled `T001#1`, `T001#2` etc. in the trades list
- `is_partial = true` on all intermediate exits and on the last exit if total filled size < entry size
- Entry fees are assigned to the first exit only; each exit carries its own fees
- For stats that require a "full trade result" (win rate, profit factor, avg win/loss, avg R, ROI), all exits for a `trade_id` are aggregated into one result — only counted once the position is fully closed

---

## Stats Split — What Uses What Data

| Metric                       | Data source                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| Net P&L                      | All exits including partials                                       |
| Daily / Weekly / Monthly P&L | All exits including partials                                       |
| Equity Curve                 | All exits including partials                                       |
| Drawdown                     | All exits including partials                                       |
| Streak (last 5)              | All exits including partials                                       |
| Day Win %                    | All exit days                                                      |
| Trade Count                  | Unique trade openings (strips `#N` suffix)                         |
| Win Rate                     | Fully closed trades only (aggregated)                              |
| Profit Factor                | Fully closed trades only (aggregated)                              |
| Avg Win / Avg Loss           | Fully closed trades only (aggregated)                              |
| Avg Win/Loss Ratio           | Fully closed trades only (aggregated)                              |
| Avg R Multiple               | Fully closed trades only (aggregated)                              |
| ROI                          | Fully closed trades only (aggregated)                              |
| Largest Win / Loss           | Fully closed trades only (aggregated P&L, last exit for note link) |
| Entry Time Performance       | Fully closed exits only                                            |
| Trade Duration               | Fully closed exits only                                            |
| Strategy Breakdown           | Fully closed exits only                                            |
| Grade Breakdown              | Fully closed exits only                                            |
| Market Conditions vs P&L     | Fully closed exits only                                            |

---

## Source Files

| File               | Lines | Responsibility                             |
| ------------------ | ----- | ------------------------------------------ |
| `src/types.ts`          | 207   | All TypeScript interfaces and types                                          |
| `src/parser.ts`         | 179   | Vault scanning and markdown table parsing                                    |
| `src/matcher.ts`        | 136   | Entry/exit matching and P&L calculation                                      |
| `src/cache.ts`          | 134   | Cache persistence and file watching                                          |
| `src/stats.ts`          | 548   | All statistics calculations                                                  |
| `src/dashboard.ts`      | 1982  | All UI rendering (charts, tables, filters, market monitor tab)              |
| `src/market-monitor.ts` | 698   | Market Data parsing, market-table sync logic, latest-close cache             |
| `src/main.ts`           | 359   | Plugin entry point, views, commands                                          |

---

## Feature → File Reference

| Feature                      | Primary file(s)                                        | How it works                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trade table parsing**      | `parser.ts`                                            | Scans all `.md` files under `Master/Journal/`, finds tables with a `trade_id` column, parses each row into a `TradeRow` object. Extracts date from filename using regex `(\d{4}-\d{2}-\d{2})`.                                                                     |
| **Accounts.md parsing**      | `parser.ts`                                            | Looks for a table with `account` and `amount` columns in `Accounts.md` at vault root. Returns `AccountEvent[]`.                                                                                                                                                    |
| **Market score extraction**  | `parser.ts` → `extractMarketScores()`                  | Reads `score` (or `market_score`) frontmatter from each daily note via Obsidian's `metadataCache`. Strips emoji prefixes before `Number()` conversion.                                                                                                             |
| **Entry/exit matching**      | `matcher.ts` → `matchTrades()`                         | Groups `TradeRow[]` by `trade_id`. For each group, generates one `Trade` per exit row. Calculates per-exit P&L, R multiple, hold time. Sets `is_partial` based on whether total filled size < entry size.                                                          |
| **Partial exit handling**    | `matcher.ts`                                           | Uses ALL exit rows (no early stopping). Entry fees assigned to first exit. Multi-exit trades get `#1`, `#2` suffixes. Open residual added to `openRows` if total filled < entry size.                                                                              |
| **P&L calculation**          | `matcher.ts` → `calcPnL()`                             | `(exitPrice - entryPrice) × size - entryFees - exitFees` for longs; inverted for shorts. Fees fully deducted.                                                                                                                                                      |
| **R multiple**               | `matcher.ts`                                           | `pnl / (abs(entryPrice - targetSL) × entrySize)`. Uses entry size (not exit size) as the risk base. Returns 0 if no `target_sl` set.                                                                                                                               |
| **Incremental cache**        | `cache.ts` → `CacheManager`                            | Stores parsed trades and file mtimes in `.trading-journal-cache.json`. On startup always does a full rebuild. File watcher triggers rebuild 2s after any journal file is saved (debounced).                                                                        |
| **Auto-refresh**             | `cache.ts` + `main.ts`                                 | `CacheManager.onUpdate()` / `offUpdate()` allow views to subscribe. Both dashboard and sidebar re-render automatically when cache rebuilds. Edits to `Market Data.md` also trigger a dashboard refresh so the Market Monitor tab updates after saves.               |
| **Stats aggregation**        | `stats.ts` → `aggregateFullTrades()`                   | Groups all exit records by base `trade_id` (strips `#N`). Sums P&L, recalculates R using full position size. Only returns trades where last exit is `is_partial=false`.                                                                                            |
| **Filters**                  | `stats.ts` + `dashboard.ts`                            | Filters by `date_from`, `date_to`, `account`, `strategy`, `grade`, `dir`, `symbol`, plus `market condition`, `weekday`, `status`, and `hold duration bucket`. The account dropdown is built from all loaded trades/open rows/account events, so additional accounts remain selectable. On open, the dashboard defaults to the `swings` account. For consistency, dashboard trade/stat filtering now uses `exit_date` throughout the closed-trade analytics and tables. |
| **Equity curve**             | `stats.ts` → `buildEquity()`                           | Starts from initial account balance. Applies deposits/withdrawals on their dates. Adds each trade's P&L in exit date order. Returns `{date, value}[]`.                                                                                                             |
| **Drawdown**                 | `stats.ts` → `buildDrawdown()`                         | Tracks running peak of equity curve. Returns `((value - peak) / peak) × 100` at each point.                                                                                                                                                                        |
| **Streak**                   | `stats.ts` → `buildStreak()`                           | Sorts all exit records by `exit_date + exit_time`. Takes last 5 as `last5`. Counts current consecutive wins/losses. Labels momentum as hot (≥3 wins), cold (≥3 losses), or mixed.                                                                                  |
| **Time slot analysis**       | `stats.ts` → `buildPnlBySlot()`                        | Buckets trades into 30-minute slots from 13:00–22:00. Uses `entry_time`. Counts winners/losers and total P&L per slot. Fully closed exits only.                                                                                                                    |
| **Calendar heatmap**         | `dashboard.ts` → `renderCalendar()`                    | Renders month grid with Mon–Sun columns + weekly totals column. Color intensity scales with P&L magnitude. Hover tooltip shows individual trades. Day number click opens daily note. Trade count click filters trades list. Navigation arrows for prev/next month. |
| **Expandable charts**        | `dashboard.ts` → `addExpandBtn()` / `showExpandModal()` | Equity Curve, Drawdown, and Market Conditions vs P&L cards include an `⤢` button that opens the chart in a centered modal overlay. The expanded view renders the same chart at a larger width for easier inspection. Click outside, press `Esc`, or use the close button to dismiss. |
| **Equity/drawdown hover**    | `dashboard.ts` → `renderEquity()` / `renderDrawdown()` | SVG crosshair lines + dot. Mouse position converted to SVG viewBox coordinates via `((clientX - rect.left) / rect.width) * W`. Tooltip shows date and value. These charts can also be expanded into a larger modal view.                                             |
| **Sortable trades table**    | `dashboard.ts` → `renderTradesList()`                  | Click column header to sort ascending; click again for descending. Active column shows ↑/↓ arrow. Click any row to open its closing daily note in Obsidian.                                                                                                        |
| **Sortable strategy table**  | `dashboard.ts` → `renderStrategyTable()`               | Same sort mechanics as trades table. Click trade count to open filtered trades list.                                                                                                                                                                               |
| **Streak dot hover**         | `dashboard.ts` → `renderStreak()`                      | Each W/L dot shows a tooltip with symbol, direction, date, P&L, and R multiple for that specific trade.                                                                                                                                                            |
| **Largest win/loss cards**   | `dashboard.ts` → `renderLargest()`                     | Uses aggregated P&L across all exits of each trade. Shows symbol, strategy, date, P&L. "→ Open note" link opens the closing daily note.                                                                                                                            |
| **Market correlation chart** | `dashboard.ts` → `renderCorrelation()`                 | Scatter plot with fixed 0–100 X axis. Vertical gridlines at grade thresholds (0, 15, 30, 50, 75, 100). Each dot is a fully closed trade; hover shows date, symbol, score, P&L. This chart can also be opened in the expandable modal view.                         |
| **Avg Win/Loss Ratio bar**   | `dashboard.ts` → `renderStatsBar()`                    | Shows ratio value + proportional green/red bar (like Tradezella). Uses `avg_win / avg_loss` from fully closed aggregated trades.                                                                                                                                   |
| **Sidebar widget**           | `main.ts` → `SidebarView`                              | Auto-opens in right panel on startup. Shows compact stats + last 5 streak dots + open positions. Open positions show target stop distance as a percentage next to `Target SL`. The sidebar also mirrors the newer Dashboard stats (`Avg R Win`, `Avg R Loss`, `Long %`, `Short %`) and supports clicking last-5 dots/open positions to open the corresponding note. Re-renders on every cache update. |
| **Latest close cache / MTM** | `market-monitor.ts` + `dashboard.ts`                  | Uses a lightweight `.trading-price-cache.json` file that stores only the latest daily close per symbol (`close`, `asOf`, `fetchedAt`). This powers mark-to-market traction, open-position detail rows, `Net+Unreal`, `Bal+Unreal`, total unrealized R, and open-risk stats without storing full price history. |
| **Dashboard view**           | `main.ts` → `DashboardView`                            | Opens as a full tab. Persists filter state across re-renders. Re-renders on tab switch (always fresh) and on cache update.                                                                                                                                         |
| **Open file from trade**     | `main.ts` → `openFile()`                               | Uses `app.vault.getAbstractFileByPath()` + `leaf.openFile()` to navigate to any daily note directly from the dashboard.                                                                                                                                            |
| **Debug command**            | `main.ts`                                              | `Ctrl+P` → "Trading Journal: Debug" dumps all matched trades grouped by exit date + market score frontmatter scan to the browser console (`Ctrl+Shift+I`).                                                                                                         |
| **Tooltip positioning**      | `dashboard.ts` → `makeTooltip()` / `positionTooltip()` | Tooltips appended to `document.body` (required for `position:fixed` to use viewport coordinates correctly). Always appear above and centered on cursor. Flip below if near top of screen. MutationObserver cleans up on dashboard close.                           |
| **Market monitor update** | `market-monitor.ts` + `main.ts`                        | Reads the `## Market Monitor` table in `Market Data.md` and recalculates only the top row's `5 day ratio` and `10 day ratio`. No daily-note frontmatter is written by the plugin. |
| **Market Monitor tab**       | `dashboard.ts` + `market-monitor.ts`                  | Adds a third dashboard tab that renders `Market Data.md` as a styled breadth monitor. Shows last 20 rows by default for `## Market Monitor`, supports date filtering, load-more paging, summary stats that respect filters, a separate filtered `## Performance Tracks` table (15 rows by default), a 52w highs/lows net oscillator, and McClellan Oscillator / Summation Index charts derived from the `## Advance/Decline` table. The charts support hover tooltips/crosshairs and per-chart expand links. |
| **Direction mix stats**      | `dashboard.ts`                                        | The main Dashboard tab now shows `Long %` and `Short %` based on unique filtered trades in the selected time period (partial exits counted once per base trade).                                                                                                  |
| **Advanced review stats** | `stats.ts` + `dashboard.ts`                            | The main Dashboard tab now shows `Avg R Win`, `Avg R Loss`, `Avg % Win`, `Avg % Loss`, `Expectancy $`, `Expectancy R`, `Median Win`, `Median Loss`, `Median R`, plus fee stats (`Fees`, `Fees % GP`, `Avg Fees`). The % stats are the average aggregated trade ROI for winning and losing fully closed trades. |
| **MTD preset**               | `dashboard.ts`                                        | The dashboard date presets now include `MTD`, which sets `date_from` to the first day of the current month and leaves `date_to` open.                                                                                                                            |
| **Open positions pie**       | `dashboard.ts` + `main.ts`                            | The main Dashboard tab includes an `Open Positions vs Cash` donut chart based on current open position cost (`entry/open price × remaining size`) plus a cash slice calculated as current balance minus open position cost. It respects dashboard filters and position slices/legend entries can be clicked to open the originating daily note. |
| **Open position detail P&L columns** | `dashboard.ts`                                   | The `Open Position Details` table now includes realized `$` and unrealized `$` columns alongside the existing `%` and `R` columns. |
| **Calendar review stats** | `stats.ts` + `dashboard.ts`                              | The calendar section now includes weekday realized P&L / win-rate cards and current/longest green-day and red-day streaks. |
| **Trade duration review stats** | `stats.ts` + `dashboard.ts`                        | The duration section now includes avg/median hold time for winners and losers above the duration distribution chart. |
| **Setup and regime breakdowns** | `stats.ts` + `dashboard.ts`                        | The dashboard now includes setup-score bucket performance and market-condition performance breakdown tables for review by quality and regime. |
| **Trades tab review extras** | `dashboard.ts`                                     | The Trades tab now includes trade-fee totals and a note preview column for faster review. |
| **Stat-card info tooltips** | `dashboard.ts`                                     | Dashboard stat cards now show an `i` badge with a simple explanation of what the stat means, its formula, and how to use it during review. |
| **Hide monetary values toggle** | `dashboard.ts` + `main.ts`                        | The dashboard header includes a `Hide $` / `Show $` toggle for sharing screenshots. Monetary values rendered via the dashboard formatter are masked while non-monetary stats remain visible. |
| **Daily-note create trigger** | `main.ts`                                              | Removed. The plugin no longer auto-updates daily-note frontmatter on note creation or note open. |

---

## Commands (Ctrl+P)

| Command                              | Action                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Open Trading Dashboard               | Opens full dashboard tab                                        |
| Open Trading Sidebar                 | Opens compact sidebar summary                                   |
| Rebuild Trading Cache                | Forces full re-scan of all journal files                        |
| Update Market Data                  | Recalculates the top-row `5 day ratio` and `10 day ratio` in `Market Data.md` |
| Trading Journal: Debug               | Dumps trade data and market scores to console                   |

---

## Installation

```
Master/.obsidian/plugins/trading-journal/
  main.js        ← built output (npm run build)
  manifest.json
  styles.css
```

**Build:**

```bash
cd trading-plugin
npm install
npm run build
```

**Dependencies:** TypeScript, esbuild, Obsidian API (all bundled — no runtime dependencies)
