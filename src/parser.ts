import { TFile, Vault, MetadataCache } from "obsidian";
import { TradeRow, TradeType, TradeDirection, AccountEvent, AccountEventType } from "./types";

const JOURNAL_FOLDER  = "Master/Journal";
const ACCOUNTS_FILE   = "Accounts.md";
const TRADE_TABLE_COL = "trade_id";

function parseNum(s: string): number {
  const n = parseFloat(s.trim());
  return isNaN(n) ? 0 : n;
}

function parseMistakes(s: string): string[] {
  if (!s || !s.trim()) return [];
  return s.split(",").map(m => m.trim()).filter(Boolean);
}

function extractDate(filename: string): string | null {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseRow(line: string): string[] {
  return line.split("|").slice(1, -1).map(c => c.trim());
}

function isSep(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableLine(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

export function parseTradeRows(content: string, date: string, filePath: string): TradeRow[] {
  const lines   = content.split("\n");
  const results: TradeRow[] = [];
  let inTable    = false;
  let colIndex: Record<string, number> = {};

  for (const line of lines) {
    if (!isTableLine(line)) {
      if (inTable) { inTable = false; colIndex = {}; }
      continue;
    }
    if (!inTable) {
      const cells = parseRow(line);
      if (cells.includes(TRADE_TABLE_COL)) {
        inTable = true;
        cells.forEach((col, idx) => { colIndex[col] = idx; });
        console.log(`[TJ Parser] Found trade table in ${filePath} with cols:`, Object.keys(colIndex));
        continue;
      }
    }
    if (isSep(line)) continue;
    if (inTable) {
      const cells = parseRow(line);
      const get   = (key: string) => colIndex[key] !== undefined ? (cells[colIndex[key]] ?? "").trim() : "";
      const trade_id = get("trade_id");
      if (!trade_id) continue;
      console.log(`[TJ Parser] Row in ${filePath}: trade_id=${trade_id} type=${get("type")} symbol=${get("symbol")} size=${get("size")} price=${get("price")}`);

      const row: TradeRow = {
        trade_id,
        symbol:   get("symbol"),
        type:     get("type") as TradeType,
        price:    parseNum(get("price")),
        size:     parseNum(get("size")),
        fees:     parseNum(get("fees")),
        time:     get("time"),
        account:  get("account"),
        note:     get("note"),
        mistakes: parseMistakes(get("mistakes")),
        date,
        filePath,
      };

      const dir = get("dir");
      if (dir) row.dir = dir as TradeDirection;

      const strategy = get("strategy");
      if (strategy) row.strategy = strategy;

      // 'score' column in trade table = trade setup score (0-55)
      const tradeScore = get("score");
      if (tradeScore) row.trade_score = parseNum(tradeScore);

      const sl = get("target_sl");
      if (sl) row.target_sl = parseNum(sl);

      results.push(row);
    }
  }
  return results;
}

export function parseAccountEvents(content: string): AccountEvent[] {
  const lines   = content.split("\n");
  const results: AccountEvent[] = [];
  let inTable    = false;
  let colIndex: Record<string, number> = {};

  for (const line of lines) {
    if (!isTableLine(line)) { if (inTable) { inTable = false; colIndex = {}; } continue; }
    if (!inTable) {
      const cells = parseRow(line);
      if (cells.includes("account") && cells.includes("amount")) {
        inTable = true; cells.forEach((col, idx) => { colIndex[col] = idx; }); continue;
      }
    }
    if (isSep(line)) continue;
    if (inTable) {
      const cells = parseRow(line);
      const get   = (key: string) => colIndex[key] !== undefined ? (cells[colIndex[key]] ?? "").trim() : "";
      const account = get("account");
      if (!account) continue;
      results.push({ account, date: get("date"), type: get("type") as AccountEventType, amount: parseNum(get("amount")), note: get("note") });
    }
  }
  return results;
}

export async function scanVaultForTrades(
  vault: Vault,
  cachedMtimes: Record<string, number>,
  onProgress?: (current: number, total: number) => void
): Promise<{ rows: TradeRow[]; accountEvents: AccountEvent[]; newMtimes: Record<string, number>; changedFiles: number }> {
  const journalFiles = vault.getFiles().filter(f => f.path.startsWith(JOURNAL_FOLDER) && f.extension === "md");
  const newMtimes:   Record<string, number> = { ...cachedMtimes };
  const allRows:     TradeRow[] = [];
  let changedFiles = 0, processed = 0;

  for (const file of journalFiles) {
    processed++;
    if (onProgress) onProgress(processed, journalFiles.length);
    const mtime = file.stat.mtime;
    if (cachedMtimes[file.path] === mtime) continue;
    changedFiles++;
    newMtimes[file.path] = mtime;
    const date = extractDate(file.basename);
    if (!date) continue;
    const content = await vault.cachedRead(file);
    allRows.push(...parseTradeRows(content, date, file.path));
  }

  let accountEvents: AccountEvent[] = [];
  const acctFile = vault.getAbstractFileByPath(ACCOUNTS_FILE);
  if (acctFile instanceof TFile) {
    const content = await vault.cachedRead(acctFile);
    accountEvents = parseAccountEvents(content);
    newMtimes[ACCOUNTS_FILE] = acctFile.stat.mtime;
  }

  return { rows: allRows, accountEvents, newMtimes, changedFiles };
}

export function extractMarketScores(vault: Vault, metadataCache: MetadataCache): Record<string, number> {
  const scores: Record<string, number> = {};
  const journalFiles = vault.getFiles().filter(f => f.path.startsWith(JOURNAL_FOLDER) && f.extension === "md");

  for (const file of journalFiles) {
    const date = extractDate(file.basename);
    if (!date) continue;
    const fm = metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    // 'score' in frontmatter = market conditions score written by Dataview block
    const marketScore = fm["score"] ?? fm["market_score"];
    if (marketScore !== undefined && marketScore !== null) {
      // Strip emojis, bullet points and non-numeric chars before parsing
      // e.g. "●30" or "🟢 70" should become 30 and 70
      const cleaned = String(marketScore).replace(/[^0-9.\-]/g, "").trim();
      const parsed  = Number(cleaned);
      if (cleaned !== "" && !isNaN(parsed)) {
        scores[date] = parsed;
      }
    }
  }
  return scores;
}
