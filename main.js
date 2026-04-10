/* Trading Journal Plugin */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TradingJournalPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/cache.ts
var import_obsidian2 = require("obsidian");

// src/parser.ts
var import_obsidian = require("obsidian");
var JOURNAL_FOLDER = "Master/Journal";
var ACCOUNTS_FILE = "Accounts.md";
var TRADE_TABLE_COL = "trade_id";
function parseNum(s) {
  const n = parseFloat(s.trim());
  return isNaN(n) ? 0 : n;
}
function parseMistakes(s) {
  if (!s || !s.trim())
    return [];
  return s.split(",").map((m) => m.trim()).filter(Boolean);
}
function extractDate(filename) {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function parseRow(line) {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}
function isSep(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}
function isTableLine(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}
function parseTradeRows(content, date, filePath) {
  const lines = content.split("\n");
  const results = [];
  let inTable = false;
  let colIndex = {};
  for (const line of lines) {
    if (!isTableLine(line)) {
      if (inTable) {
        inTable = false;
        colIndex = {};
      }
      continue;
    }
    if (!inTable) {
      const cells = parseRow(line);
      if (cells.includes(TRADE_TABLE_COL)) {
        inTable = true;
        cells.forEach((col, idx) => {
          colIndex[col] = idx;
        });
        console.log(`[TJ Parser] Found trade table in ${filePath} with cols:`, Object.keys(colIndex));
        continue;
      }
    }
    if (isSep(line))
      continue;
    if (inTable) {
      const cells = parseRow(line);
      const get = (key) => {
        var _a;
        return colIndex[key] !== void 0 ? ((_a = cells[colIndex[key]]) != null ? _a : "").trim() : "";
      };
      const trade_id = get("trade_id");
      if (!trade_id)
        continue;
      console.log(`[TJ Parser] Row in ${filePath}: trade_id=${trade_id} type=${get("type")} symbol=${get("symbol")} size=${get("size")} price=${get("price")}`);
      const row = {
        trade_id,
        symbol: get("symbol"),
        type: get("type"),
        price: parseNum(get("price")),
        size: parseNum(get("size")),
        fees: parseNum(get("fees")),
        time: get("time"),
        account: get("account"),
        note: get("note"),
        mistakes: parseMistakes(get("mistakes")),
        date,
        filePath
      };
      const dir = get("dir");
      if (dir)
        row.dir = dir;
      const strategy = get("strategy");
      if (strategy)
        row.strategy = strategy;
      const tradeScore = get("score");
      if (tradeScore)
        row.trade_score = parseNum(tradeScore);
      const sl = get("target_sl");
      if (sl)
        row.target_sl = parseNum(sl);
      results.push(row);
    }
  }
  return results;
}
function parseAccountEvents(content) {
  const lines = content.split("\n");
  const results = [];
  let inTable = false;
  let colIndex = {};
  for (const line of lines) {
    if (!isTableLine(line)) {
      if (inTable) {
        inTable = false;
        colIndex = {};
      }
      continue;
    }
    if (!inTable) {
      const cells = parseRow(line);
      if (cells.includes("account") && cells.includes("amount")) {
        inTable = true;
        cells.forEach((col, idx) => {
          colIndex[col] = idx;
        });
        continue;
      }
    }
    if (isSep(line))
      continue;
    if (inTable) {
      const cells = parseRow(line);
      const get = (key) => {
        var _a;
        return colIndex[key] !== void 0 ? ((_a = cells[colIndex[key]]) != null ? _a : "").trim() : "";
      };
      const account = get("account");
      if (!account)
        continue;
      results.push({ account, date: get("date"), type: get("type"), amount: parseNum(get("amount")), note: get("note") });
    }
  }
  return results;
}
function scanVaultForTrades(vault, cachedMtimes, onProgress) {
  return __async(this, null, function* () {
    const journalFiles = vault.getFiles().filter((f) => f.path.startsWith(JOURNAL_FOLDER) && f.extension === "md");
    const newMtimes = __spreadValues({}, cachedMtimes);
    const allRows = [];
    let changedFiles = 0, processed = 0;
    for (const file of journalFiles) {
      processed++;
      if (onProgress)
        onProgress(processed, journalFiles.length);
      const mtime = file.stat.mtime;
      if (cachedMtimes[file.path] === mtime)
        continue;
      changedFiles++;
      newMtimes[file.path] = mtime;
      const date = extractDate(file.basename);
      if (!date)
        continue;
      const content = yield vault.cachedRead(file);
      allRows.push(...parseTradeRows(content, date, file.path));
    }
    let accountEvents = [];
    const acctFile = vault.getAbstractFileByPath(ACCOUNTS_FILE);
    if (acctFile instanceof import_obsidian.TFile) {
      const content = yield vault.cachedRead(acctFile);
      accountEvents = parseAccountEvents(content);
      newMtimes[ACCOUNTS_FILE] = acctFile.stat.mtime;
    }
    return { rows: allRows, accountEvents, newMtimes, changedFiles };
  });
}
function extractMarketScores(vault, metadataCache) {
  var _a, _b;
  const scores = {};
  const journalFiles = vault.getFiles().filter((f) => f.path.startsWith(JOURNAL_FOLDER) && f.extension === "md");
  for (const file of journalFiles) {
    const date = extractDate(file.basename);
    if (!date)
      continue;
    const fm = (_a = metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    if (!fm)
      continue;
    const marketScore = (_b = fm["score"]) != null ? _b : fm["market_score"];
    if (marketScore !== void 0 && marketScore !== null) {
      const cleaned = String(marketScore).replace(/[^0-9.\-]/g, "").trim();
      const parsed = Number(cleaned);
      if (cleaned !== "" && !isNaN(parsed)) {
        scores[date] = parsed;
      }
    }
  }
  return scores;
}

// src/matcher.ts
function getGrade(score) {
  if (score >= 40)
    return "A";
  if (score >= 30)
    return "B";
  if (score >= 15)
    return "C";
  return "D";
}
function calcHoldMinutes(ed, et, xd, xt) {
  try {
    const entry = new Date(`${ed}T${et.padStart(5, "0")}:00`);
    const exit = new Date(`${xd}T${xt.padStart(5, "0")}:00`);
    return Math.round((exit.getTime() - entry.getTime()) / 6e4);
  } catch (e) {
    return 0;
  }
}
function calcHoldDays(ed, xd) {
  try {
    return Math.round((new Date(xd).getTime() - new Date(ed).getTime()) / 864e5);
  } catch (e) {
    return 0;
  }
}
function calcPnL(dir, ep, xp, size, ef, xf) {
  return (dir === "long" ? (xp - ep) * size : (ep - xp) * size) - ef - xf;
}
function compareTradeRowDateTime(a, b) {
  const [ay, am, ad] = a.date.split("-").map(Number);
  const [by, bm, bd] = b.date.split("-").map(Number);
  const [ah = 0, amin = 0] = a.time.split(":").map(Number);
  const [bh = 0, bmin = 0] = b.time.split(":").map(Number);
  return new Date(ay, am - 1, ad, ah, amin).getTime() - new Date(by, bm - 1, bd, bh, bmin).getTime();
}
function matchTrades(rows, marketScores) {
  var _a, _b, _c, _d;
  const byId = {};
  for (const row of rows) {
    if (!byId[row.trade_id])
      byId[row.trade_id] = [];
    byId[row.trade_id].push(row);
  }
  const trades = [];
  const openRows = [];
  for (const [trade_id, tradeRows] of Object.entries(byId)) {
    const entries = tradeRows.filter((r) => r.type === "entry");
    const exits = tradeRows.filter((r) => r.type === "exit");
    if (!entries.length)
      continue;
    entries.sort(compareTradeRowDateTime);
    exits.sort(compareTradeRowDateTime);
    const entry = entries[0];
    if (!exits.length) {
      openRows.push(entry);
      continue;
    }
    const dir = (_a = entry.dir) != null ? _a : "long";
    const strategy = (_b = entry.strategy) != null ? _b : "";
    const trade_score = (_c = entry.trade_score) != null ? _c : 0;
    const target_sl = (_d = entry.target_sl) != null ? _d : 0;
    const riskPerUnit = Math.abs(entry.price - target_sl);
    const totalExitSize = exits.reduce((s, e) => s + e.size, 0);
    const isPartial = parseFloat(totalExitSize.toFixed(6)) < parseFloat(entry.size.toFixed(6));
    let remainingEntryFees = entry.fees;
    exits.forEach((ex, idx) => {
      const exitFee = ex.fees;
      const entryFeeShare = idx === 0 ? remainingEntryFees : 0;
      const pnl = calcPnL(dir, entry.price, ex.price, ex.size, entryFeeShare, exitFee);
      const r_multiple = riskPerUnit > 0 ? parseFloat((pnl / (riskPerUnit * ex.size)).toFixed(2)) : 0;
      const entryCost = entry.price * ex.size;
      const pnl_pct = entryCost > 0 ? pnl / entryCost * 100 : 0;
      const display_id = exits.length > 1 ? `${trade_id}#${idx + 1}` : trade_id;
      trades.push({
        trade_id: display_id,
        symbol: entry.symbol,
        dir,
        strategy,
        trade_score,
        grade: getGrade(trade_score),
        target_sl,
        account: entry.account,
        entry_date: entry.date,
        entry_time: entry.time,
        entry_price: entry.price,
        entry_size: entry.size,
        entry_fees: entry.fees,
        entry_note: entry.note,
        entry_mistakes: entry.mistakes,
        entry_file: entry.filePath,
        exit_date: ex.date,
        exit_time: ex.time,
        exit_price: ex.price,
        exit_fees: exitFee,
        exit_note: ex.note,
        exit_mistakes: ex.mistakes,
        exit_file: ex.filePath,
        filled_size: ex.size,
        // is_partial = true if position is not fully closed yet at this exit
        // For the last exit: true if total fills < entry size (still open residual)
        // For intermediate exits: always true (more exits may follow)
        is_partial: idx < exits.length - 1 ? true : isPartial,
        exit_count: exits.length,
        pnl: parseFloat(pnl.toFixed(2)),
        pnl_pct: parseFloat(pnl_pct.toFixed(4)),
        r_multiple,
        hold_days: calcHoldDays(entry.date, ex.date),
        hold_minutes: calcHoldMinutes(entry.date, entry.time, ex.date, ex.time),
        is_winner: pnl > 0,
        market_score: marketScores[entry.date]
      });
    });
    if (isPartial)
      openRows.push(__spreadProps(__spreadValues({}, entry), { size: entry.size - totalExitSize }));
  }
  trades.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  return { trades, openRows };
}

// src/cache.ts
var CACHE_FILE = ".trading-journal-cache.json";
var CACHE_VERSION = 2;
var DEBOUNCE_MS = 2e3;
var MARKET_DATA_FILE = "Market Data.md";
function emptyCache() {
  return {
    version: CACHE_VERSION,
    last_updated: new Date().toISOString(),
    trades: [],
    open_rows: [],
    account_events: [],
    file_mtimes: {}
  };
}
var CacheManager = class {
  constructor(plugin) {
    this.debounceTimer = null;
    this.isBuilding = false;
    this.isReady = false;
    this.listeners = [];
    this.plugin = plugin;
    this.cache = emptyCache();
  }
  initialize() {
    return __async(this, null, function* () {
      yield this.buildCache(true);
      this.registerFileWatcher();
      this.isReady = true;
    });
  }
  onUpdate(listener) {
    this.listeners.push(listener);
  }
  offUpdate(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }
  getTrades() {
    return this.cache.trades;
  }
  getOpenRows() {
    return this.cache.open_rows;
  }
  getAccountEvents() {
    return this.cache.account_events;
  }
  getLastUpdated() {
    return this.cache.last_updated;
  }
  getIsReady() {
    return this.isReady;
  }
  rebuild(onProgress) {
    return __async(this, null, function* () {
      yield this.buildCache(true, onProgress);
    });
  }
  saveCache() {
    return __async(this, null, function* () {
      try {
        this.cache.last_updated = new Date().toISOString();
        yield this.plugin.app.vault.adapter.write(
          CACHE_FILE,
          JSON.stringify(this.cache, null, 2)
        );
      } catch (e) {
        console.error("Trading Journal: failed to save cache", e);
      }
    });
  }
  buildCache(full = false, onProgress) {
    return __async(this, null, function* () {
      if (this.isBuilding)
        return;
      this.isBuilding = true;
      try {
        const vault = this.plugin.app.vault;
        const metadataCache = this.plugin.app.metadataCache;
        onProgress == null ? void 0 : onProgress("Scanning vault...");
        const { rows, accountEvents, newMtimes } = yield scanVaultForTrades(vault, {}, (cur, total) => {
          onProgress == null ? void 0 : onProgress(`Scanning ${cur}/${total} files...`);
        });
        onProgress == null ? void 0 : onProgress("Matching trades...");
        const marketScores = extractMarketScores(vault, metadataCache);
        const { trades, openRows } = matchTrades(rows, marketScores);
        this.cache = {
          version: CACHE_VERSION,
          last_updated: new Date().toISOString(),
          trades,
          open_rows: openRows,
          account_events: accountEvents,
          file_mtimes: newMtimes
        };
        yield this.saveCache();
        onProgress == null ? void 0 : onProgress(`Done \u2014 ${trades.length} trades loaded.`);
        this.notifyListeners();
      } catch (e) {
        console.error("Trading Journal: cache build failed", e);
      } finally {
        this.isBuilding = false;
      }
    });
  }
  registerFileWatcher() {
    const { vault } = this.plugin.app;
    const trigger = (file) => {
      if (!(file instanceof import_obsidian2.TFile))
        return;
      const isTradeFile = file.path.startsWith("Master/Journal") || file.path === "Accounts.md";
      const isMarketData = file.path === MARKET_DATA_FILE;
      if (!isTradeFile && !isMarketData)
        return;
      if (this.debounceTimer !== null)
        window.clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
        if (isMarketData && !isTradeFile) {
          this.notifyListeners();
        } else {
          this.buildCache(true);
        }
        this.debounceTimer = null;
      }, DEBOUNCE_MS);
    };
    this.plugin.registerEvent(vault.on("modify", trigger));
    this.plugin.registerEvent(vault.on("create", trigger));
    this.plugin.registerEvent(vault.on("delete", trigger));
  }
};

// src/stats.ts
function countUniqueTrades(trades) {
  const ids = new Set(trades.map((t) => t.trade_id.replace(/#\d+$/, "")));
  return ids.size;
}
function filterTrades(trades, f) {
  return trades.filter((t) => {
    if (f.date_from && t.entry_date < f.date_from)
      return false;
    if (f.date_to && t.entry_date > f.date_to)
      return false;
    if (f.account && t.account !== f.account)
      return false;
    if (f.strategy && t.strategy !== f.strategy)
      return false;
    if (f.grade && t.grade !== f.grade)
      return false;
    if (f.dir && t.dir !== f.dir)
      return false;
    if (f.symbol && t.symbol.toUpperCase() !== f.symbol.toUpperCase())
      return false;
    return true;
  });
}
function aggregateFullTrades(trades) {
  const byId = {};
  trades.forEach((t) => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    if (!byId[baseId])
      byId[baseId] = [];
    byId[baseId].push(t);
  });
  const result = [];
  Object.values(byId).forEach((group) => {
    const lastExit = group[group.length - 1];
    if (lastExit.is_partial)
      return;
    const totalPnl = group.reduce((s, t) => s + t.pnl, 0);
    const totalSize = group.reduce((s, t) => s + t.filled_size, 0);
    const entryCost = group[0].entry_price * totalSize;
    const pnl_pct = entryCost > 0 ? totalPnl / entryCost * 100 : 0;
    const riskPerUnit = Math.abs(group[0].entry_price - group[0].target_sl);
    const r_multiple = riskPerUnit > 0 && totalSize > 0 ? parseFloat((totalPnl / (riskPerUnit * group[0].entry_size)).toFixed(2)) : 0;
    result.push({
      pnl: parseFloat(totalPnl.toFixed(2)),
      r_multiple,
      is_winner: totalPnl > 0,
      pnl_pct: parseFloat(pnl_pct.toFixed(4))
    });
  });
  return result;
}
function localDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function weekKey(dateStr) {
  const d = localDate(dateStr);
  const dow = d.getDay();
  const off = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}
function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
function toDateTimeMs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h = 0, min = 0] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}
function buildStreak(trades) {
  if (!trades.length)
    return { last5: [], current_streak: 0, longest_win: 0, longest_loss: 0, momentum: "none" };
  const sorted = [...trades].sort((a, b) => toDateTimeMs(a.exit_date, a.exit_time) - toDateTimeMs(b.exit_date, b.exit_time));
  const last5 = sorted.slice(-5).reverse().map((t) => ({ trade: t, is_winner: t.is_winner }));
  let cur = 0, longestW = 0, longestL = 0, streak = 0;
  for (const t of sorted) {
    if (t.is_winner) {
      streak = streak > 0 ? streak + 1 : 1;
      longestW = Math.max(longestW, streak);
    } else {
      streak = streak < 0 ? streak - 1 : -1;
      longestL = Math.max(longestL, Math.abs(streak));
    }
    cur = streak;
  }
  const wins5 = last5.filter((s) => s.is_winner).length;
  const momentum = last5.length < 2 ? "none" : cur >= 3 ? "hot" : cur <= -3 ? "cold" : wins5 >= 3 ? "hot" : wins5 <= 1 ? "cold" : "mixed";
  return { last5, current_streak: cur, longest_win: longestW, longest_loss: longestL, momentum };
}
function buildEquity(trades, events, account) {
  var _a, _b;
  const ev = account ? events.filter((e) => e.account === account) : events;
  let bal = ev.filter((e) => e.type === "initial").reduce((s, e) => s + e.amount, 0) || 1e4;
  const cf = {};
  ev.forEach((e) => {
    var _a2, _b2;
    if (e.type === "deposit")
      cf[e.date] = ((_a2 = cf[e.date]) != null ? _a2 : 0) + e.amount;
    if (e.type === "withdrawal")
      cf[e.date] = ((_b2 = cf[e.date]) != null ? _b2 : 0) - e.amount;
  });
  const sorted = [...trades].sort((a, b) => toDateTimeMs(a.exit_date, a.exit_time) - toDateTimeMs(b.exit_date, b.exit_time));
  const curve = [{ date: (_b = (_a = sorted[0]) == null ? void 0 : _a.entry_date) != null ? _b : "", value: bal }];
  for (const t of sorted) {
    if (cf[t.exit_date]) {
      bal += cf[t.exit_date];
      delete cf[t.exit_date];
    }
    bal += t.pnl;
    curve.push({ date: t.exit_date, value: parseFloat(bal.toFixed(2)) });
  }
  return curve;
}
function buildDrawdown(equity) {
  var _a, _b;
  let peak = (_b = (_a = equity[0]) == null ? void 0 : _a.value) != null ? _b : 0;
  return equity.map((p) => {
    if (p.value > peak)
      peak = p.value;
    return { date: p.date, value: parseFloat((peak > 0 ? (p.value - peak) / peak * 100 : 0).toFixed(2)) };
  });
}
function buildDailyPnl(trades) {
  const m = {};
  trades.forEach((t) => {
    if (!m[t.exit_date])
      m[t.exit_date] = { pnl: 0, count: 0 };
    m[t.exit_date].pnl += t.pnl;
    m[t.exit_date].count += 1;
  });
  return Object.entries(m).map(([d, v]) => ({ date: d, pnl: parseFloat(v.pnl.toFixed(2)), count: v.count })).sort((a, b) => a.date.localeCompare(b.date));
}
function buildWeeklyPnl(trades) {
  const m = {};
  trades.forEach((t) => {
    const wk = weekKey(t.exit_date);
    if (!m[wk])
      m[wk] = { pnl: 0, count: 0 };
    m[wk].pnl += t.pnl;
    m[wk].count += 1;
  });
  return Object.entries(m).map(([w, v]) => ({ week: w, pnl: parseFloat(v.pnl.toFixed(2)), count: v.count })).sort((a, b) => a.week.localeCompare(b.week));
}
function buildMonthlyPnl(trades) {
  const m = {};
  trades.forEach((t) => {
    const mk = monthKey(t.exit_date);
    if (!m[mk])
      m[mk] = { pnl: 0, count: 0 };
    m[mk].pnl += t.pnl;
    m[mk].count += 1;
  });
  return Object.entries(m).map(([mo, v]) => ({ month: mo, pnl: parseFloat(v.pnl.toFixed(2)), count: v.count })).sort((a, b) => a.month.localeCompare(b.month));
}
function buildPnlBySlot(trades) {
  const slots = [];
  for (let h = 13; h < 22; h++) {
    for (const m of [0, 30]) {
      const label = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      slots.push({ slot: label, pnl: 0, winners: 0, losers: 0 });
    }
  }
  slots.push({ slot: "22:00", pnl: 0, winners: 0, losers: 0 });
  trades.forEach((t) => {
    const [h, min] = t.entry_time.split(":").map(Number);
    if (h < 13 || h > 22)
      return;
    const slotH = h;
    const slotM = min < 30 ? 0 : 30;
    const label = `${String(slotH).padStart(2, "0")}:${slotM === 0 ? "00" : "30"}`;
    const slot = slots.find((s) => s.slot === label);
    if (!slot)
      return;
    slot.pnl += t.pnl;
    t.is_winner ? slot.winners++ : slot.losers++;
  });
  return slots.map((s) => __spreadProps(__spreadValues({}, s), { pnl: parseFloat(s.pnl.toFixed(2)) }));
}
function buildDuration(trades) {
  const buckets = [
    { label: "<1h", min: 0, max: 60 },
    { label: "1-4h", min: 60, max: 240 },
    { label: "4-8h", min: 240, max: 480 },
    { label: "1-3d", min: 480, max: 4320 },
    { label: ">3d", min: 4320, max: Infinity }
  ];
  return buckets.map((b) => {
    const t = trades.filter((t2) => t2.hold_minutes >= b.min && t2.hold_minutes < b.max);
    return { bucket: b.label, winners: t.filter((t2) => t2.is_winner).length, losers: t.filter((t2) => !t2.is_winner).length };
  });
}
function buildStrategyStats(trades) {
  const m = {};
  trades.forEach((t) => {
    const s = t.strategy || "Unknown";
    if (!m[s])
      m[s] = [];
    m[s].push(t);
  });
  const r = {};
  Object.entries(m).forEach(([s, ts]) => {
    const w = ts.filter((t) => t.is_winner), l = ts.filter((t) => !t.is_winner);
    const gw = w.reduce((a, t) => a + t.pnl, 0), gl = Math.abs(l.reduce((a, t) => a + t.pnl, 0));
    r[s] = { strategy: s, net_pnl: parseFloat(ts.reduce((a, t) => a + t.pnl, 0).toFixed(2)), trade_count: ts.length, win_rate: ts.length > 0 ? parseFloat((w.length / ts.length * 100).toFixed(1)) : 0, profit_factor: gl > 0 ? parseFloat((gw / gl).toFixed(2)) : gw > 0 ? Infinity : 0, avg_r: ts.length > 0 ? parseFloat((ts.reduce((a, t) => a + t.r_multiple, 0) / ts.length).toFixed(2)) : 0 };
  });
  return r;
}
function buildGradeStats(trades) {
  const r = {};
  ["A", "B", "C", "D"].forEach((g) => {
    const ts = trades.filter((t) => t.grade === g), w = ts.filter((t) => t.is_winner);
    r[g] = { grade: g, net_pnl: parseFloat(ts.reduce((a, t) => a + t.pnl, 0).toFixed(2)), trade_count: ts.length, win_rate: ts.length > 0 ? parseFloat((w.length / ts.length * 100).toFixed(1)) : 0, avg_r: ts.length > 0 ? parseFloat((ts.reduce((a, t) => a + t.r_multiple, 0) / ts.length).toFixed(2)) : 0 };
  });
  return r;
}
function calcStats(trades, accountEvents, filters) {
  var _a, _b, _c, _d;
  const ft = filterTrades(trades, filters);
  const initBal = accountEvents.filter((e) => (!filters.account || e.account === filters.account) && e.type === "initial").reduce((s, e) => s + e.amount, 0) || 1e4;
  const allEquity = buildEquity(trades.filter((t) => !filters.account || t.account === filters.account), accountEvents, filters.account);
  const currentBalance = (_b = (_a = allEquity[allEquity.length - 1]) == null ? void 0 : _a.value) != null ? _b : initBal;
  const empty = () => ({
    net_pnl: 0,
    trade_count: 0,
    exit_count: 0,
    win_count: 0,
    loss_count: 0,
    win_rate: 0,
    profit_factor: 0,
    avg_win_loss_ratio: 0,
    avg_win: 0,
    avg_loss: 0,
    avg_r_multiple: 0,
    avg_r_win: 0,
    avg_r_loss: 0,
    gain_to_pain: 0,
    largest_win: 0,
    largest_loss: 0,
    day_win_rate: 0,
    overall_roi: 0,
    max_drawdown: 0,
    max_drawdown_pct: 0,
    current_balance: parseFloat(currentBalance.toFixed(2)),
    streak: { last5: [], current_streak: 0, longest_win: 0, longest_loss: 0, momentum: "none" },
    equity_curve: [],
    drawdown_curve: [],
    daily_pnl: [],
    weekly_pnl: [],
    monthly_pnl: [],
    pnl_by_slot: [],
    duration_by_outcome: [],
    pnl_by_strategy: {},
    pnl_by_grade: buildGradeStats([]),
    market_correlation: []
  });
  if (!ft.length)
    return empty();
  const wins = ft.filter((t) => t.is_winner);
  const losses = ft.filter((t) => !t.is_winner);
  const net_pnl = parseFloat(ft.reduce((s, t) => s + t.pnl, 0).toFixed(2));
  const daily = buildDailyPnl(ft);
  const winDays = daily.filter((d) => d.pnl > 0).length;
  const equity = buildEquity(ft, accountEvents, filters.account);
  const dd = buildDrawdown(equity);
  const maxDdPct = Math.abs(Math.min(...dd.map((d) => d.value)));
  const fullTrades = aggregateFullTrades(ft);
  const ftWins = fullTrades.filter((t) => t.is_winner);
  const ftLosses = fullTrades.filter((t) => !t.is_winner);
  const gw = ftWins.reduce((s, t) => s + t.pnl, 0);
  const gl = Math.abs(ftLosses.reduce((s, t) => s + t.pnl, 0));
  const closedExits = ft.filter((t) => !t.is_partial);
  const pnlByBase = {};
  const lastExitByBase = {};
  ft.forEach((t) => {
    var _a2;
    const baseId = t.trade_id.replace(/#[0-9]+$/, "");
    pnlByBase[baseId] = ((_a2 = pnlByBase[baseId]) != null ? _a2 : 0) + t.pnl;
    lastExitByBase[baseId] = t;
  });
  const closedBaseIds = new Set(closedExits.map((t) => t.trade_id.replace(/#[0-9]+$/, "")));
  let bestBaseId = "", worstBaseId = "", bestPnl = -Infinity, worstPnl = Infinity;
  closedBaseIds.forEach((id) => {
    var _a2;
    const p = (_a2 = pnlByBase[id]) != null ? _a2 : 0;
    if (p > bestPnl) {
      bestPnl = p;
      bestBaseId = id;
    }
    if (p < worstPnl) {
      worstPnl = p;
      worstBaseId = id;
    }
  });
  const largestWinTrade = bestBaseId ? lastExitByBase[bestBaseId] : void 0;
  const largestLossTrade = worstBaseId ? lastExitByBase[worstBaseId] : void 0;
  const largestWinPnl = bestBaseId ? (_c = pnlByBase[bestBaseId]) != null ? _c : 0 : 0;
  const largestLossPnl = worstBaseId ? (_d = pnlByBase[worstBaseId]) != null ? _d : 0 : 0;
  return {
    net_pnl,
    trade_count: countUniqueTrades(ft),
    exit_count: ft.length,
    win_count: ftWins.length,
    loss_count: ftLosses.length,
    win_rate: fullTrades.length > 0 ? parseFloat((ftWins.length / fullTrades.length * 100).toFixed(1)) : 0,
    profit_factor: gl > 0 ? parseFloat((gw / gl).toFixed(2)) : gw > 0 ? Infinity : 0,
    avg_win: ftWins.length > 0 ? parseFloat((gw / ftWins.length).toFixed(2)) : 0,
    avg_loss: ftLosses.length > 0 ? parseFloat((gl / ftLosses.length).toFixed(2)) : 0,
    avg_r_multiple: fullTrades.length > 0 ? parseFloat((fullTrades.reduce((s, t) => s + t.r_multiple, 0) / fullTrades.length).toFixed(2)) : 0,
    avg_r_win: ftWins.length > 0 ? parseFloat((ftWins.reduce((s, t) => s + t.r_multiple, 0) / ftWins.length).toFixed(2)) : 0,
    avg_r_loss: ftLosses.length > 0 ? parseFloat((ftLosses.reduce((s, t) => s + t.r_multiple, 0) / ftLosses.length).toFixed(2)) : 0,
    avg_win_loss_ratio: ftWins.length > 0 && ftLosses.length > 0 ? parseFloat((gw / ftWins.length / (gl / ftLosses.length)).toFixed(2)) : 0,
    gain_to_pain: gl > 0 ? parseFloat((gw / gl).toFixed(2)) : gw > 0 ? Infinity : 0,
    largest_win: largestWinPnl > 0 ? largestWinPnl : 0,
    largest_win_trade: largestWinTrade,
    largest_loss: largestLossPnl < 0 ? Math.abs(largestLossPnl) : 0,
    largest_loss_trade: largestLossTrade,
    day_win_rate: daily.length > 0 ? parseFloat((winDays / daily.length * 100).toFixed(1)) : 0,
    overall_roi: fullTrades.length > 0 ? parseFloat((fullTrades.reduce((s, t) => s + t.pnl, 0) / initBal * 100).toFixed(2)) : 0,
    max_drawdown: parseFloat(Math.abs(maxDdPct * initBal / 100).toFixed(2)),
    max_drawdown_pct: parseFloat(maxDdPct.toFixed(2)),
    current_balance: parseFloat(currentBalance.toFixed(2)),
    streak: buildStreak(ft),
    equity_curve: equity,
    drawdown_curve: dd,
    daily_pnl: daily,
    weekly_pnl: buildWeeklyPnl(ft),
    monthly_pnl: buildMonthlyPnl(ft),
    pnl_by_slot: buildPnlBySlot(closedExits),
    // fully closed only
    duration_by_outcome: buildDuration(closedExits),
    // fully closed only
    pnl_by_strategy: buildStrategyStats(closedExits),
    // fully closed only
    pnl_by_grade: buildGradeStats(closedExits),
    // fully closed only
    market_correlation: closedExits.filter((t) => t.market_score !== void 0).map((t) => ({ score: t.market_score, pnl: t.pnl, date: t.entry_date, symbol: t.symbol }))
  };
}

// src/market-monitor.ts
var import_obsidian3 = require("obsidian");
var JOURNAL_FOLDER2 = "Master/Journal";
var MARKET_DATA_FILE2 = "Market Data.md";
var PRICE_CACHE_FILE = ".trading-price-cache.json";
var JOURNAL_DATE_RE = /(\d{4}-\d{2}-\d{2})/;
var MARKET_MONITOR_HEADING = /^##\s+Market Monitor\s*$/i;
var ADV_DEC_HEADING = /^##\s+Advance\/Decline\s*$/i;
var HIGH_LOW_HEADING = /^##\s+52w Highs\/Lows\s*$/i;
var PERFORMANCE_TRACKS_HEADING = /^##\s+Performance Tracks\s*$/i;
function parseTableRow(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}
function isTableLine2(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}
function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function getGrade2(score) {
  if (score >= 40)
    return "A";
  if (score >= 30)
    return "B";
  if (score >= 15)
    return "C";
  return "D";
}
function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatRatio(value) {
  return value.toFixed(2);
}
function parseNum2(value) {
  const cleaned = String(value != null ? value : "").replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
function parseNullableNum(value) {
  const cleaned = String(value != null ? value : "").trim();
  if (!cleaned || cleaned === "-")
    return null;
  const parsed = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function parseDdMmYyyyToIso(value) {
  const m = String(value != null ? value : "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m)
    return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
function formatIsoToDisplay(value) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m)
    return value;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}
function extractJournalDate(file) {
  var _a, _b;
  return (_b = (_a = file.basename.match(JOURNAL_DATE_RE)) == null ? void 0 : _a[1]) != null ? _b : null;
}
function isWeekday(dateIso) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day >= 1 && day <= 5;
}
function findTableByHeading(content, headingPattern) {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (headingIndex === -1)
    return null;
  let headerIndex = -1;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (isTableLine2(lines[i])) {
      headerIndex = i;
      break;
    }
    if (lines[i].trim().startsWith("## "))
      break;
  }
  if (headerIndex === -1 || headerIndex + 1 >= lines.length || !isTableLine2(lines[headerIndex + 1]))
    return null;
  let endIndex = headerIndex + 2;
  while (endIndex < lines.length && isTableLine2(lines[endIndex]))
    endIndex++;
  endIndex -= 1;
  const headers = parseTableRow(lines[headerIndex]);
  const rows = lines.slice(headerIndex + 2, endIndex + 1).map(parseTableRow);
  return {
    headers,
    rows,
    blockStart: headerIndex,
    blockEnd: endIndex,
    blockText: lines.slice(headerIndex, endIndex + 1).join("\n")
  };
}
function formatMarkdownTable(headers, rows) {
  const widths = headers.map((header, idx) => {
    const rowWidths = rows.map((row) => {
      var _a;
      return ((_a = row[idx]) != null ? _a : "").length;
    });
    return Math.max(header.length, ...rowWidths, 3);
  });
  const formatRow = (cells) => `| ${cells.map((cell, idx) => (cell != null ? cell : "").padEnd(widths[idx])).join(" | ")} |`;
  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  return [formatRow(headers), separator, ...rows.map(formatRow)].join("\n");
}
function computeRollingRatio(rows, upIdx, downIdx, lookback) {
  if (rows.length < lookback)
    return "-";
  const sample = rows.slice(0, lookback);
  const totalUp = sample.reduce((sum, row) => {
    var _a;
    return sum + parseNum2((_a = row[upIdx]) != null ? _a : "0");
  }, 0);
  const totalDown = sample.reduce((sum, row) => {
    var _a;
    return sum + parseNum2((_a = row[downIdx]) != null ? _a : "0");
  }, 0);
  if (totalDown <= 0)
    return "-";
  return formatRatio(totalUp / totalDown);
}
function findColumnIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates.map(normalizeHeader)) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1)
      return idx;
  }
  return -1;
}
function sortAscByDate(rows) {
  return [...rows].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}
function sortDescByDate(rows) {
  return [...rows].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}
function average(values) {
  if (!values.length)
    return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function emaSeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period)
    return out;
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const k = 2 / (period + 1);
  let current = seed;
  out[period - 1] = current;
  for (let i = period; i < values.length; i++) {
    current = values[i] * k + current * (1 - k);
    out[i] = current;
  }
  return out;
}
function ema(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}
function computeHighLowSignals(rows) {
  const asc = sortAscByDate(rows);
  let positiveStreak = 0;
  let nonPositiveStreak = 0;
  let signal = "false";
  const withSignals = asc.map((row) => {
    if (row.net > 0) {
      positiveStreak += 1;
      nonPositiveStreak = 0;
      if (positiveStreak >= 3)
        signal = "true";
    } else {
      nonPositiveStreak += 1;
      positiveStreak = 0;
      if (nonPositiveStreak >= 3)
        signal = "false";
    }
    return __spreadProps(__spreadValues({}, row), { signal });
  });
  return sortDescByDate(withSignals);
}
function buildMarketMonitorRows(headers, rows) {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxUp4 = findColumnIndex(headers, ["4%+ Up Today"]);
  const idxDown4 = findColumnIndex(headers, ["4%+ Down today"]);
  const idxRatio5 = findColumnIndex(headers, ["5 day ratio"]);
  const idxRatio10 = findColumnIndex(headers, ["10 day ratio"]);
  const idxUpQuarter25 = findColumnIndex(headers, ["25%+ Up in a Quarter"]);
  const idxDownQuarter25 = findColumnIndex(headers, ["25%+ Down in a Quarter"]);
  const idxUpMonth25 = findColumnIndex(headers, ["25%+ Up in Month"]);
  const idxDownMonth25 = findColumnIndex(headers, ["25%+ Down in a Month"]);
  const idxUpMonth50 = findColumnIndex(headers, ["50%+ Up in a month"]);
  const idxDownMonth50 = findColumnIndex(headers, ["50%+ Down in a month"]);
  const idxUp34 = findColumnIndex(headers, ["13%+ Up in 34 days"]);
  const idxDown34 = findColumnIndex(headers, ["13%+ Down in 34 days"]);
  const idxT2108 = findColumnIndex(headers, ["T2108", "T2018"]);
  if ([idxDate, idxUp4, idxDown4, idxRatio5, idxRatio10, idxUpQuarter25, idxDownQuarter25, idxUpMonth25, idxDownMonth25, idxUpMonth50, idxDownMonth50, idxUp34, idxDown34].some((idx) => idx === -1)) {
    return [];
  }
  return rows.map((row) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const dateIso = parseDdMmYyyyToIso((_a = row[idxDate]) != null ? _a : "");
    if (!dateIso)
      return null;
    return {
      dateIso,
      dateDisplay: (_b = row[idxDate]) != null ? _b : formatIsoToDisplay(dateIso),
      up4: parseNum2((_c = row[idxUp4]) != null ? _c : "0"),
      down4: parseNum2((_d = row[idxDown4]) != null ? _d : "0"),
      ratio5: parseNullableNum((_e = row[idxRatio5]) != null ? _e : ""),
      ratio10: parseNullableNum((_f = row[idxRatio10]) != null ? _f : ""),
      upQuarter25: parseNum2((_g = row[idxUpQuarter25]) != null ? _g : "0"),
      downQuarter25: parseNum2((_h = row[idxDownQuarter25]) != null ? _h : "0"),
      upMonth25: parseNum2((_i = row[idxUpMonth25]) != null ? _i : "0"),
      downMonth25: parseNum2((_j = row[idxDownMonth25]) != null ? _j : "0"),
      upMonth50: parseNum2((_k = row[idxUpMonth50]) != null ? _k : "0"),
      downMonth50: parseNum2((_l = row[idxDownMonth50]) != null ? _l : "0"),
      up34: parseNum2((_m = row[idxUp34]) != null ? _m : "0"),
      down34: parseNum2((_n = row[idxDown34]) != null ? _n : "0"),
      t2108: idxT2108 === -1 ? null : parseNullableNum((_o = row[idxT2108]) != null ? _o : "")
    };
  }).filter((row) => row !== null);
}
function buildHighLowRows(headers, rows) {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxHigh = findColumnIndex(headers, ["52w high", "52 week high", "52whigh"]);
  const idxLow = findColumnIndex(headers, ["52w low", "52 week low", "52wlow"]);
  if ([idxDate, idxHigh, idxLow].some((idx) => idx === -1))
    return [];
  const parsed = rows.map((row) => {
    var _a, _b, _c, _d;
    const dateIso = parseDdMmYyyyToIso((_a = row[idxDate]) != null ? _a : "");
    if (!dateIso)
      return null;
    const high52 = parseNum2((_b = row[idxHigh]) != null ? _b : "0");
    const low52 = parseNum2((_c = row[idxLow]) != null ? _c : "0");
    return {
      dateIso,
      dateDisplay: (_d = row[idxDate]) != null ? _d : formatIsoToDisplay(dateIso),
      high52,
      low52,
      net: high52 - low52,
      signal: "false"
    };
  }).filter((row) => row !== null);
  return computeHighLowSignals(parsed);
}
function buildPerformanceTrackRows(headers, rows) {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxUp8 = findColumnIndex(headers, ["8%+ Up 5d"]);
  const idxDown8 = findColumnIndex(headers, ["8%+ Down 5d"]);
  const idxUp20 = findColumnIndex(headers, ["20%+ Up 5d"]);
  const idxDown20 = findColumnIndex(headers, ["20%+ Down 5d"]);
  const idxAbove21 = findColumnIndex(headers, ["%Above 21SMA", "% Above 21SMA"]);
  const idxAbove200 = findColumnIndex(headers, ["%Above 200SMA", "% Above 200SMA"]);
  if ([idxDate, idxUp8, idxDown8, idxUp20, idxDown20, idxAbove21, idxAbove200].some((idx) => idx === -1))
    return [];
  return rows.map((row) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const dateIso = parseDdMmYyyyToIso((_a = row[idxDate]) != null ? _a : "");
    if (!dateIso)
      return null;
    return {
      dateIso,
      dateDisplay: (_b = row[idxDate]) != null ? _b : formatIsoToDisplay(dateIso),
      up8_5d: parseNum2((_c = row[idxUp8]) != null ? _c : "0"),
      down8_5d: parseNum2((_d = row[idxDown8]) != null ? _d : "0"),
      up20_5d: parseNum2((_e = row[idxUp20]) != null ? _e : "0"),
      down20_5d: parseNum2((_f = row[idxDown20]) != null ? _f : "0"),
      above21sma: parseNum2((_g = row[idxAbove21]) != null ? _g : "0"),
      above200sma: parseNum2((_h = row[idxAbove200]) != null ? _h : "0")
    };
  }).filter((row) => row !== null);
}
function buildAdvanceDeclineRows(headers, rows) {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxAdvance = findColumnIndex(headers, ["Advance", "Advances"]);
  const idxDecline = findColumnIndex(headers, ["Decline", "Declines"]);
  if ([idxDate, idxAdvance, idxDecline].some((idx) => idx === -1))
    return [];
  const parsed = rows.map((row) => {
    var _a, _b, _c, _d;
    const dateIso = parseDdMmYyyyToIso((_a = row[idxDate]) != null ? _a : "");
    if (!dateIso)
      return null;
    const advance = parseNum2((_b = row[idxAdvance]) != null ? _b : "0");
    const decline = parseNum2((_c = row[idxDecline]) != null ? _c : "0");
    return {
      dateIso,
      dateDisplay: (_d = row[idxDate]) != null ? _d : formatIsoToDisplay(dateIso),
      advance,
      decline,
      net: advance - decline,
      mcclellan: null,
      summation: null
    };
  }).filter((row) => row !== null);
  const asc = sortAscByDate(parsed);
  const nets = asc.map((row) => row.net);
  const ema19 = emaSeries(nets, 19);
  const ema39 = emaSeries(nets, 39);
  let runningSummation = null;
  const withIndicators = asc.map((row, idx) => {
    const fast = ema19[idx];
    const slow = ema39[idx];
    const mcclellan = fast !== null && slow !== null ? fast - slow : null;
    if (mcclellan !== null) {
      runningSummation = runningSummation === null ? mcclellan : runningSummation + mcclellan;
    }
    return __spreadProps(__spreadValues({}, row), {
      mcclellan,
      summation: runningSummation
    });
  });
  return sortDescByDate(withIndicators);
}
function fetchCloses(symbol, interval, period1, period2) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
    const res = yield (0, import_obsidian3.requestUrl)({
      url,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });
    const payload = res.json;
    const result = (_b = (_a = payload == null ? void 0 : payload.chart) == null ? void 0 : _a.result) == null ? void 0 : _b[0];
    const closes = (_e = (_d = (_c = result == null ? void 0 : result.indicators) == null ? void 0 : _c.quote) == null ? void 0 : _d[0]) == null ? void 0 : _e.close;
    if (!Array.isArray(closes))
      throw new Error(`Yahoo Finance returned no closes for ${symbol} (${interval})`);
    return closes.filter((value) => typeof value === "number" && Number.isFinite(value));
  });
}
function fetchLatestClose(symbol) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f;
    const nowSec = Math.floor(Date.now() / 1e3);
    const period1 = nowSec - 20 * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${nowSec}&interval=1d&includePrePost=false&events=div%2Csplits`;
    const res = yield (0, import_obsidian3.requestUrl)({
      url,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });
    const result = (_c = (_b = (_a = res.json) == null ? void 0 : _a.chart) == null ? void 0 : _b.result) == null ? void 0 : _c[0];
    const timestamps = result == null ? void 0 : result.timestamp;
    const closes = (_f = (_e = (_d = result == null ? void 0 : result.indicators) == null ? void 0 : _d.quote) == null ? void 0 : _e[0]) == null ? void 0 : _f.close;
    if (!Array.isArray(timestamps) || !Array.isArray(closes))
      throw new Error(`Yahoo Finance returned no latest close for ${symbol}`);
    for (let i = closes.length - 1; i >= 0; i--) {
      const close = closes[i];
      const ts = timestamps[i];
      if (typeof close === "number" && Number.isFinite(close) && typeof ts === "number") {
        const dt = new Date(ts * 1e3).toISOString().slice(0, 10);
        return { symbol, close, asOf: dt, fetchedAt: new Date().toISOString() };
      }
    }
    throw new Error(`Yahoo Finance returned no numeric close for ${symbol}`);
  });
}
function fetchQqqeSignalsForDate(noteDateIso) {
  return __async(this, null, function* () {
    const [y, m, d] = noteDateIso.split("-").map(Number);
    const period2 = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1e3);
    const dailyPeriod1 = period2 - 180 * 24 * 60 * 60;
    const weeklyPeriod1 = period2 - 900 * 24 * 60 * 60;
    const [dailyCloses, weeklyCloses] = yield Promise.all([
      fetchCloses("QQQE", "1d", dailyPeriod1, period2),
      fetchCloses("QQQE", "1wk", weeklyPeriod1, period2)
    ]);
    const dailyClose = dailyCloses[dailyCloses.length - 1];
    const dailyEma5 = ema(dailyCloses, 5);
    const dailyEma10 = ema(dailyCloses, 10);
    const dailyEma20 = ema(dailyCloses, 20);
    const weeklyClose = weeklyCloses[weeklyCloses.length - 1];
    const weeklyEma10 = ema(weeklyCloses, 10);
    const weeklyEma20 = ema(weeklyCloses, 20);
    return {
      qqqe_ema1020: Boolean(dailyEma10 !== null && dailyEma20 !== null && dailyClose > dailyEma10 && dailyClose > dailyEma20 && dailyEma10 > dailyEma20),
      qqqe_ema5: Boolean(dailyEma5 !== null && dailyClose > dailyEma5),
      qqqe_wema1020: Boolean(weeklyEma10 !== null && weeklyEma20 !== null && weeklyClose > weeklyEma10 && weeklyClose > weeklyEma20 && weeklyEma10 > weeklyEma20)
    };
  });
}
function tradePassesFilters(row, filters) {
  var _a;
  if (filters.date_from && row.dateIso < filters.date_from)
    return false;
  if (filters.date_to && row.dateIso > filters.date_to)
    return false;
  if (filters.account && row.account !== filters.account)
    return false;
  if (filters.strategy && row.strategy !== filters.strategy)
    return false;
  if (filters.dir && row.dir !== filters.dir)
    return false;
  if (filters.symbol && ((_a = row.symbol) != null ? _a : "").toUpperCase() !== filters.symbol.toUpperCase())
    return false;
  if (filters.grade && row.grade !== filters.grade)
    return false;
  return true;
}
var MarketMonitorService = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  readPriceCache() {
    return __async(this, null, function* () {
      var _a;
      try {
        const exists = yield this.plugin.app.vault.adapter.exists(PRICE_CACHE_FILE);
        if (!exists)
          return { prices: {} };
        const raw = yield this.plugin.app.vault.adapter.read(PRICE_CACHE_FILE);
        const parsed = JSON.parse(raw);
        return { prices: (_a = parsed == null ? void 0 : parsed.prices) != null ? _a : {} };
      } catch (e) {
        return { prices: {} };
      }
    });
  }
  savePriceCache(cache) {
    return __async(this, null, function* () {
      yield this.plugin.app.vault.adapter.write(PRICE_CACHE_FILE, JSON.stringify(cache, null, 2));
    });
  }
  isPriceFresh(info) {
    if (!info)
      return false;
    const fetchedMs = new Date(info.fetchedAt).getTime();
    return Number.isFinite(fetchedMs) && Date.now() - fetchedMs < 6 * 60 * 60 * 1e3;
  }
  getLatestCloses(symbols) {
    return __async(this, null, function* () {
      const uniqueSymbols = [...new Set(symbols.filter(Boolean).map((s) => s.toUpperCase()))];
      const cache = yield this.readPriceCache();
      const result = {};
      for (const symbol of uniqueSymbols) {
        const cached = cache.prices[symbol];
        if (this.isPriceFresh(cached)) {
          result[symbol] = cached;
          continue;
        }
        try {
          const latest = yield fetchLatestClose(symbol);
          cache.prices[symbol] = latest;
          result[symbol] = latest;
        } catch (e) {
          if (cached)
            result[symbol] = cached;
          console.error(`Trading Journal: failed to fetch latest close for ${symbol}`, e);
        }
      }
      yield this.savePriceCache(cache);
      return result;
    });
  }
  computeTractionSignal(noteDateIso) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const cacheManager = this.plugin.cache;
      const trades = (_b = (_a = cacheManager == null ? void 0 : cacheManager.getTrades) == null ? void 0 : _a.call(cacheManager)) != null ? _b : [];
      const openRows = (_d = (_c = cacheManager == null ? void 0 : cacheManager.getOpenRows) == null ? void 0 : _c.call(cacheManager)) != null ? _d : [];
      const baseIds = /* @__PURE__ */ new Set([
        ...trades.filter((t) => t.entry_date < noteDateIso).map((t) => t.trade_id.replace(/#\d+$/, "")),
        ...openRows.filter((r) => r.date < noteDateIso).map((r) => r.trade_id)
      ]);
      const ranked = [...baseIds].map((baseId) => {
        var _a2, _b2, _c2, _d2;
        const related = trades.filter((t) => t.trade_id.replace(/#\d+$/, "") === baseId && t.entry_date < noteDateIso);
        const lastExit = related.length ? [...related].sort((a, b) => `${b.exit_date} ${b.exit_time}`.localeCompare(`${a.exit_date} ${a.exit_time}`))[0] : null;
        const entryDate = (_d2 = (_c2 = (_a2 = related[0]) == null ? void 0 : _a2.entry_date) != null ? _c2 : (_b2 = openRows.find((r) => r.trade_id === baseId)) == null ? void 0 : _b2.date) != null ? _d2 : "";
        const sortKey = lastExit ? `${lastExit.exit_date} ${lastExit.exit_time}` : `${entryDate} 00:00`;
        return { baseId, sortKey };
      }).sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 5);
      const relevantOpenRows = openRows.filter((r) => ranked.some((x) => x.baseId === r.trade_id));
      const analytics = yield this.getOpenPositionAnalytics(trades, relevantOpenRows, 0, {});
      const openMap = new Map(analytics.positions.map((p) => [p.baseId, p]));
      const totalR = ranked.reduce((sum, item) => {
        var _a2, _b2;
        const related = trades.filter((t) => t.trade_id.replace(/#\d+$/, "") === item.baseId);
        if (openMap.has(item.baseId))
          return sum + ((_b2 = (_a2 = openMap.get(item.baseId)) == null ? void 0 : _a2.totalR) != null ? _b2 : 0);
        const total = related.reduce((acc, t) => acc + t.r_multiple, 0);
        return sum + total;
      }, 0);
      return totalR > 0 ? "true" : "false";
    });
  }
  getOpenPositionAnalytics(_0, _1, _2) {
    return __async(this, arguments, function* (trades, openRows, currentBalance, filters = {}) {
      const openByBase = /* @__PURE__ */ new Map();
      openRows.forEach((r) => openByBase.set(r.trade_id, r));
      const relevant = [...openByBase.values()].filter((r) => {
        var _a;
        return tradePassesFilters({
          dateIso: r.date,
          account: r.account,
          strategy: r.strategy,
          dir: r.dir,
          symbol: r.symbol,
          grade: getGrade2((_a = r.trade_score) != null ? _a : 0)
        }, filters);
      });
      const latest = yield this.getLatestCloses(relevant.map((r) => r.symbol));
      const positions = relevant.map((r) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const baseId = r.trade_id;
        const related = trades.filter((t) => t.trade_id.replace(/#\d+$/, "") === baseId);
        const entrySize = (_b = (_a = related[0]) == null ? void 0 : _a.entry_size) != null ? _b : r.size;
        const riskAmount = Math.abs((r.price - ((_c = r.target_sl) != null ? _c : 0)) * entrySize);
        const realizedPnl = related.reduce((sum, t) => sum + t.pnl, 0);
        const latestClose = latest[r.symbol.toUpperCase()];
        const currentPrice = (_d = latestClose == null ? void 0 : latestClose.close) != null ? _d : r.price;
        const unrealizedPnl = r.dir === "short" ? (r.price - currentPrice) * r.size : (currentPrice - r.price) * r.size;
        const fullCost = r.price * entrySize || 1;
        const stopRiskRemaining = r.target_sl ? Math.abs((currentPrice - r.target_sl) * r.size) : 0;
        return {
          baseId,
          symbol: r.symbol,
          dir: (_e = r.dir) != null ? _e : "long",
          account: r.account,
          strategy: (_f = r.strategy) != null ? _f : "",
          grade: getGrade2((_g = r.trade_score) != null ? _g : 0),
          entryDate: r.date,
          entryFile: r.filePath,
          entryPrice: r.price,
          entrySize,
          remainingSize: r.size,
          targetSl: (_h = r.target_sl) != null ? _h : 0,
          openingValue: r.price * r.size,
          currentValue: currentPrice * r.size,
          realizedPnl: parseFloat(realizedPnl.toFixed(2)),
          unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
          realizedPct: parseFloat((realizedPnl / fullCost * 100).toFixed(2)),
          unrealizedPct: parseFloat((unrealizedPnl / fullCost * 100).toFixed(2)),
          realizedR: riskAmount > 0 ? parseFloat((realizedPnl / riskAmount).toFixed(2)) : 0,
          unrealizedR: riskAmount > 0 ? parseFloat((unrealizedPnl / riskAmount).toFixed(2)) : 0,
          totalR: riskAmount > 0 ? parseFloat(((realizedPnl + unrealizedPnl) / riskAmount).toFixed(2)) : 0,
          latestClose
        };
      });
      const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const totalUnrealizedR = positions.reduce((sum, p) => sum + p.unrealizedR, 0);
      const totalOpenRiskToStop = positions.reduce((sum, p) => {
        var _a, _b;
        return sum + Math.abs((((_b = (_a = p.latestClose) == null ? void 0 : _a.close) != null ? _b : p.entryPrice) - p.targetSl) * p.remainingSize);
      }, 0);
      const grossExposure = positions.reduce((sum, p) => sum + p.currentValue, 0);
      return {
        positions,
        totalUnrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
        totalUnrealizedR: parseFloat(totalUnrealizedR.toFixed(2)),
        totalOpenRiskToStop: parseFloat(totalOpenRiskToStop.toFixed(2)),
        grossExposure: parseFloat(grossExposure.toFixed(2)),
        cashValue: parseFloat(Math.max(0, currentBalance - grossExposure).toFixed(2)),
        netPnlWithUnrealized: 0,
        balanceWithUnrealized: parseFloat((currentBalance + totalUnrealizedPnl).toFixed(2))
      };
    });
  }
  syncForCreatedFile(file) {
    return __async(this, null, function* () {
      if (!(file instanceof import_obsidian3.TFile))
        return;
      if (!this.isEligibleJournalFile(file))
        return;
      try {
        yield this.syncNote(file);
      } catch (e) {
        console.error("Trading Journal: market monitor auto-sync failed", e);
      }
    });
  }
  syncActiveOrTodayNote() {
    return __async(this, null, function* () {
      const active = this.plugin.app.workspace.getActiveFile();
      if (active instanceof import_obsidian3.TFile && this.isEligibleJournalFile(active)) {
        return this.syncNote(active);
      }
      const today = todayIso();
      const fallback = this.plugin.app.vault.getFiles().find((file) => {
        const dateIso = extractJournalDate(file);
        return this.isEligibleJournalFile(file) && dateIso === today;
      });
      if (!fallback) {
        return { updatedMarketData: yield this.updateMarketDataOnly(), updatedFrontmatter: false, skipped: "No active or today's weekday daily note found." };
      }
      return this.syncNote(fallback);
    });
  }
  getDashboardData() {
    return __async(this, null, function* () {
      const marketData = yield this.updateMarketDataTable();
      if (!marketData)
        return null;
      return {
        monitorRows: marketData.monitorRows,
        highLowRows: marketData.highLowRows,
        advanceDeclineRows: marketData.advanceDeclineRows,
        performanceTrackRows: marketData.performanceTrackRows
      };
    });
  }
  isEligibleJournalFile(file) {
    if (file.extension !== "md" || !file.path.startsWith(JOURNAL_FOLDER2))
      return false;
    const dateIso = extractJournalDate(file);
    if (!dateIso)
      return false;
    if (dateIso < todayIso())
      return false;
    return isWeekday(dateIso);
  }
  syncNote(file) {
    return __async(this, null, function* () {
      const noteDate = extractJournalDate(file);
      if (!noteDate)
        return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Daily note date not found in filename." };
      if (noteDate < todayIso())
        return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Only today's and future notes are updated." };
      if (!isWeekday(noteDate))
        return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Weekend note skipped." };
      const marketData = yield this.updateMarketDataTable();
      if (!marketData)
        return { updatedMarketData: false, updatedFrontmatter: false, skipped: `Could not read ${MARKET_DATA_FILE2}.` };
      const previousMonitorRow = marketData.monitorRows.find((row) => row.dateIso < noteDate);
      if (!previousMonitorRow) {
        return { updatedMarketData: marketData.updated, updatedFrontmatter: false, skipped: `No market monitor row found before ${noteDate}.` };
      }
      const previousHighLowRow = marketData.highLowRows.find((row) => row.dateIso < noteDate);
      let qqqeSignals = {};
      try {
        qqqeSignals = yield fetchQqqeSignalsForDate(noteDate);
      } catch (e) {
        console.error("Trading Journal: failed to fetch QQQE signals", e);
      }
      let traction = "false";
      try {
        traction = yield this.computeTractionSignal(noteDate);
      } catch (e) {
        console.error("Trading Journal: failed to compute traction", e);
      }
      yield this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        var _a;
        frontmatter["4up_down"] = previousMonitorRow.up4 > previousMonitorRow.down4 ? "true" : "false";
        frontmatter["5d_ratio"] = previousMonitorRow.ratio5 !== null && previousMonitorRow.ratio5 >= 1 ? "true" : "false";
        frontmatter["high_lows"] = (_a = previousHighLowRow == null ? void 0 : previousHighLowRow.signal) != null ? _a : "false";
        frontmatter["traction"] = traction;
        if (qqqeSignals.qqqe_ema1020 !== void 0)
          frontmatter["qqqe_ema1020"] = qqqeSignals.qqqe_ema1020 ? "true" : "false";
        if (qqqeSignals.qqqe_ema5 !== void 0)
          frontmatter["qqqe_ema5"] = qqqeSignals.qqqe_ema5 ? "true" : "false";
        if (qqqeSignals.qqqe_wema1020 !== void 0)
          frontmatter["qqqe_wema1020"] = qqqeSignals.qqqe_wema1020 ? "true" : "false";
      });
      return { updatedMarketData: marketData.updated, updatedFrontmatter: true };
    });
  }
  updateMarketDataOnly() {
    return __async(this, null, function* () {
      var _a;
      const result = yield this.updateMarketDataTable();
      return (_a = result == null ? void 0 : result.updated) != null ? _a : false;
    });
  }
  readMarketDataDocument() {
    return __async(this, null, function* () {
      const file = this.plugin.app.vault.getAbstractFileByPath(MARKET_DATA_FILE2);
      if (!(file instanceof import_obsidian3.TFile))
        return null;
      const content = yield this.plugin.app.vault.cachedRead(file);
      return {
        file,
        content,
        marketMonitor: findTableByHeading(content, MARKET_MONITOR_HEADING),
        highLows: findTableByHeading(content, HIGH_LOW_HEADING),
        advanceDecline: findTableByHeading(content, ADV_DEC_HEADING),
        performanceTracks: findTableByHeading(content, PERFORMANCE_TRACKS_HEADING)
      };
    });
  }
  updateMarketDataTable() {
    return __async(this, null, function* () {
      const doc = yield this.readMarketDataDocument();
      if (!doc || !doc.marketMonitor)
        return null;
      const headers = doc.marketMonitor.headers;
      const idxUp = findColumnIndex(headers, ["4%+ Up Today"]);
      const idxDown = findColumnIndex(headers, ["4%+ Down today"]);
      const idxRatio5 = findColumnIndex(headers, ["5 day ratio"]);
      const idxRatio10 = findColumnIndex(headers, ["10 day ratio"]);
      if ([idxUp, idxDown, idxRatio5, idxRatio10].some((idx) => idx === -1))
        return null;
      const rows = doc.marketMonitor.rows.map((row) => [...row]);
      if (rows.length) {
        rows[0][idxRatio5] = computeRollingRatio(rows, idxUp, idxDown, 5);
        rows[0][idxRatio10] = computeRollingRatio(rows, idxUp, idxDown, 10);
      }
      const newTable = formatMarkdownTable(headers, rows);
      let updated = false;
      let content = doc.content;
      if (newTable !== doc.marketMonitor.blockText) {
        const lines = content.split("\n");
        const replacement = newTable.split("\n");
        lines.splice(doc.marketMonitor.blockStart, doc.marketMonitor.blockEnd - doc.marketMonitor.blockStart + 1, ...replacement);
        content = lines.join("\n");
        yield this.plugin.app.vault.modify(doc.file, content);
        updated = true;
      }
      const finalMarketTable = updated ? findTableByHeading(content, MARKET_MONITOR_HEADING) : __spreadProps(__spreadValues({}, doc.marketMonitor), { rows, blockText: newTable });
      const finalHighLows = findTableByHeading(content, HIGH_LOW_HEADING);
      const finalAdvanceDecline = findTableByHeading(content, ADV_DEC_HEADING);
      const finalPerformanceTracks = findTableByHeading(content, PERFORMANCE_TRACKS_HEADING);
      return {
        updated,
        monitorRows: finalMarketTable ? buildMarketMonitorRows(finalMarketTable.headers, finalMarketTable.rows) : [],
        highLowRows: finalHighLows ? buildHighLowRows(finalHighLows.headers, finalHighLows.rows) : [],
        advanceDeclineRows: finalAdvanceDecline ? buildAdvanceDeclineRows(finalAdvanceDecline.headers, finalAdvanceDecline.rows) : [],
        performanceTrackRows: finalPerformanceTracks ? buildPerformanceTrackRows(finalPerformanceTracks.headers, finalPerformanceTracks.rows) : []
      };
    });
  }
};
var MarketMonitorMath = {
  average,
  sortAscByDate,
  sortDescByDate
};

// src/dashboard.ts
var C = {
  bg: "var(--background-primary)",
  card: "var(--background-secondary)",
  border: "var(--background-modifier-border)",
  text: "var(--text-normal)",
  muted: "var(--text-muted)",
  faint: "var(--text-faint)",
  green: "#4ade80",
  red: "#f87171",
  yellow: "#facc15",
  orange: "#fb923c",
  blue: "#60a5fa",
  purple: "#a78bfa"
};
var F = "var(--font-interface),var(--font-text),monospace";
var pc = (v) => v >= 0 ? C.green : C.red;
var fmtUSD = (v) => {
  const a = Math.abs(v).toFixed(2);
  return v < 0 ? `-$${a}` : `$${a}`;
};
var fmt = (v, d = 2) => v.toFixed(d);
function div(p, style = "") {
  return p.createEl("div", { attr: { style } });
}
function card(p, style = "") {
  return div(p, `background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:16px;${style}`);
}
function cardTitle(p, t) {
  p.createEl("div", { text: t, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;font-family:${F};` } });
}
function badge(p, text, color, bg) {
  p.createEl("span", { text, attr: { style: `background:${bg};color:${color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:${F};` } });
}
var NS = "http://www.w3.org/2000/svg";
function svg(p, w, h) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("width", "100%");
  s.setAttribute("height", String(h));
  p.appendChild(s);
  return s;
}
function sLine(s, x1, y1, x2, y2, c, w = 1) {
  const e = document.createElementNS(NS, "line");
  e.setAttribute("x1", String(x1));
  e.setAttribute("y1", String(y1));
  e.setAttribute("x2", String(x2));
  e.setAttribute("y2", String(y2));
  e.setAttribute("stroke", c);
  e.setAttribute("stroke-width", String(w));
  s.appendChild(e);
  return e;
}
function sPath(s, d, stroke, fill = "none", w = 2) {
  const e = document.createElementNS(NS, "path");
  e.setAttribute("d", d);
  e.setAttribute("stroke", stroke);
  e.setAttribute("stroke-width", String(w));
  e.setAttribute("fill", fill);
  e.setAttribute("stroke-linejoin", "round");
  e.setAttribute("stroke-linecap", "round");
  s.appendChild(e);
}
function sRect(s, x, y, w, h, fill, rx = 2, title = "") {
  const e = document.createElementNS(NS, "rect");
  e.setAttribute("x", String(x));
  e.setAttribute("y", String(y));
  e.setAttribute("width", String(Math.max(0, w)));
  e.setAttribute("height", String(Math.max(0, h)));
  e.setAttribute("fill", fill);
  e.setAttribute("rx", String(rx));
  if (title) {
    const t = document.createElementNS(NS, "title");
    t.textContent = title;
    e.appendChild(t);
  }
  s.appendChild(e);
  return e;
}
function sText(s, x, y, text, c, sz = 9, anchor = "middle") {
  const e = document.createElementNS(NS, "text");
  e.setAttribute("x", String(x));
  e.setAttribute("y", String(y));
  e.setAttribute("fill", c);
  e.setAttribute("font-size", String(sz));
  e.setAttribute("text-anchor", anchor);
  e.setAttribute("font-family", F);
  e.textContent = text;
  s.appendChild(e);
}
function sCircle(s, cx, cy, r, fill, opacity = 0.75, title = "") {
  const e = document.createElementNS(NS, "circle");
  e.setAttribute("cx", String(cx));
  e.setAttribute("cy", String(cy));
  e.setAttribute("r", String(r));
  e.setAttribute("fill", fill);
  e.setAttribute("opacity", String(opacity));
  if (title) {
    const t = document.createElementNS(NS, "title");
    t.textContent = title;
    e.appendChild(t);
  }
  s.appendChild(e);
  return e;
}
function makeTooltip(container) {
  const tt = document.body.createEl("div", { attr: { style: `position:fixed;background:#1a1a1a;border:1px solid ${C.border};border-radius:8px;padding:10px 14px;font-family:${F};font-size:11px;color:${C.text};z-index:99999;pointer-events:none;display:none;min-width:160px;box-shadow:0 4px 24px rgba(0,0,0,0.6);` } });
  const obs = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      tt.remove();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return tt;
}
function positionTooltip(tt, e) {
  const TW = 200;
  const TH = 100;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  let x = e.clientX - TW / 2;
  let y = e.clientY - TH - 14;
  x = Math.max(8, Math.min(x, VW - TW - 8));
  if (y < 8)
    y = e.clientY + 16;
  if (y + TH > VH - 8)
    y = VH - TH - 8;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
}
function showTooltip(tt, e, content) {
  tt.empty();
  content(tt);
  tt.style.display = "block";
  positionTooltip(tt, e);
}
function moveTooltip(tt, e) {
  positionTooltip(tt, e);
}
function hideTooltip(tt) {
  tt.style.display = "none";
}
function showExpandModal(title, renderFn) {
  const overlay = document.body.createEl("div", { attr: { style: `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99990;
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(4px);
  ` } });
  const modal = overlay.createEl("div", { attr: { style: `
    background:var(--background-secondary);
    border:1px solid var(--background-modifier-border);
    border-radius:14px;padding:24px;
    width:90vw;max-width:1100px;
    max-height:85vh;overflow-y:auto;
    position:relative;
  ` } });
  const hdr = modal.createEl("div", { attr: { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;" } });
  hdr.createEl("div", { text: title, attr: { style: `color:var(--text-normal);font-size:16px;font-weight:700;font-family:${F};` } });
  const closeBtn = hdr.createEl("button", { text: "\u2715", attr: { style: `
    background:transparent;border:1px solid var(--background-modifier-border);
    color:var(--text-muted);border-radius:6px;padding:4px 10px;
    cursor:pointer;font-size:14px;font-family:${F};
  ` } });
  const chartWrap = modal.createEl("div", { attr: { style: "width:100%;" } });
  renderFn(chartWrap);
  const close = () => overlay.remove();
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay)
      close();
  });
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  });
}
function addExpandBtn(parent, title, renderFn) {
  const btn = parent.createEl("button", { text: "\u2922", attr: { style: `
    background:transparent;border:1px solid var(--background-modifier-border);
    color:var(--text-muted);border-radius:4px;padding:1px 6px;
    cursor:pointer;font-size:11px;float:right;margin-top:-2px;
    font-family:${F};
  ` } });
  btn.setAttribute("title", "Expand chart");
  btn.addEventListener("click", () => showExpandModal(title, renderFn));
}
function addExpandLink(parent, title, renderFn) {
  const btn = parent.createEl("button", { text: "Expand \u2197", attr: { style: `
    background:transparent;border:none;color:${C.blue};padding:0;float:right;
    cursor:pointer;font-size:10px;font-family:${F};font-weight:700;margin-top:1px;
  ` } });
  btn.setAttribute("title", "Expand chart");
  btn.addEventListener("click", () => showExpandModal(title, renderFn));
}
function renderEquity(parent, data, chartW = 500) {
  if (data.length < 2) {
    parent.createEl("div", { text: "No data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const W = chartW, H = Math.round(chartW * 0.28), P = { t: 10, r: 10, b: 20, l: 70 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const vals = data.map((d) => d.value), minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1;
  const sx = (i) => P.l + i / (data.length - 1) * W2;
  const sy = (v) => P.t + H2 - (v - minV) / range * H2;
  const s = svg(parent, W, H);
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const y = P.t + H2 * (1 - p), v = minV + range * p;
    sLine(s, P.l, y, W - P.r, y, "rgba(255,255,255,0.04)");
    sText(s, P.l - 4, y + 3, fmtUSD(v), C.muted, 8, "end");
  });
  let fill = `M ${sx(0)} ${sy(data[0].value)}`;
  data.forEach((d, i) => {
    if (i > 0)
      fill += ` L ${sx(i)} ${sy(d.value)}`;
  });
  fill += ` L ${sx(data.length - 1)} ${P.t + H2} L ${sx(0)} ${P.t + H2} Z`;
  sPath(s, fill, "none", "rgba(96,165,250,0.08)");
  let line = `M ${sx(0)} ${sy(data[0].value)}`;
  data.forEach((d, i) => {
    if (i > 0)
      line += ` L ${sx(i)} ${sy(d.value)}`;
  });
  sPath(s, line, C.blue, "none", 2);
  const vLine = document.createElementNS(NS, "line");
  vLine.setAttribute("stroke", "rgba(255,255,255,0.2)");
  vLine.setAttribute("stroke-width", "1");
  vLine.setAttribute("stroke-dasharray", "4,3");
  vLine.style.display = "none";
  s.appendChild(vLine);
  const hLine = document.createElementNS(NS, "line");
  hLine.setAttribute("stroke", "rgba(255,255,255,0.2)");
  hLine.setAttribute("stroke-width", "1");
  hLine.setAttribute("stroke-dasharray", "4,3");
  hLine.style.display = "none";
  s.appendChild(hLine);
  const dot = sCircle(s, 0, 0, 4, C.blue, 1);
  dot.style.display = "none";
  const tt = makeTooltip(parent);
  s.addEventListener("mousemove", (e) => {
    const rect = s.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    const svgY = (e.clientY - rect.top) / rect.height * H;
    if (svgX < P.l || svgX > W - P.r || svgY < P.t || svgY > P.t + H2) {
      vLine.style.display = "none";
      hLine.style.display = "none";
      dot.style.display = "none";
      hideTooltip(tt);
      return;
    }
    const frac = (svgX - P.l) / W2;
    const idx = Math.max(0, Math.min(Math.round(frac * (data.length - 1)), data.length - 1));
    const d = data[idx];
    const cx = sx(idx), cy = sy(d.value);
    vLine.setAttribute("x1", String(cx));
    vLine.setAttribute("y1", String(P.t));
    vLine.setAttribute("x2", String(cx));
    vLine.setAttribute("y2", String(P.t + H2));
    hLine.setAttribute("x1", String(P.l));
    hLine.setAttribute("y1", String(cy));
    hLine.setAttribute("x2", String(W - P.r));
    hLine.setAttribute("y2", String(cy));
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    [vLine, hLine, dot].forEach((el) => el.style.display = "");
    showTooltip(tt, e, (el) => {
      el.createEl("div", { text: d.date, attr: { style: `color:${C.muted};font-size:10px;margin-bottom:3px;font-weight:700;` } });
      el.createEl("div", { text: fmtUSD(d.value), attr: { style: `color:${C.blue};font-size:14px;font-weight:700;` } });
    });
  });
  s.addEventListener("mouseleave", () => {
    vLine.style.display = "none";
    hLine.style.display = "none";
    dot.style.display = "none";
    hideTooltip(tt);
  });
}
function renderDrawdown(parent, data, chartW = 500) {
  if (data.length < 2)
    return;
  const W = chartW, H = Math.round(chartW * 0.18), P = { t: 5, r: 10, b: 20, l: 50 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const minV = Math.min(...data.map((d) => d.value));
  const sy = (v) => P.t + v / (minV || -1) * H2;
  const sx = (i) => P.l + i / (data.length - 1) * W2;
  const s = svg(parent, W, H);
  sLine(s, P.l, P.t, W - P.r, P.t, "rgba(255,255,255,0.04)");
  let fill = `M ${sx(0)} ${P.t}`;
  data.forEach((d, i) => {
    fill += ` L ${sx(i)} ${sy(d.value)}`;
  });
  fill += ` L ${sx(data.length - 1)} ${P.t} Z`;
  sPath(s, fill, "none", "rgba(248,113,113,0.15)");
  let line = `M ${sx(0)} ${P.t}`;
  data.forEach((d, i) => {
    if (i > 0)
      line += ` L ${sx(i)} ${sy(d.value)}`;
  });
  sPath(s, line, C.red, "none", 1.5);
  sText(s, P.l - 4, sy(minV) + 3, `${fmt(minV, 1)}%`, C.red, 8, "end");
  sText(s, P.l - 4, P.t + 6, "0%", C.muted, 8, "end");
  const vl = document.createElementNS(NS, "line");
  vl.setAttribute("stroke", "rgba(255,255,255,0.2)");
  vl.setAttribute("stroke-width", "1");
  vl.setAttribute("stroke-dasharray", "4,3");
  vl.style.display = "none";
  s.appendChild(vl);
  const dot = sCircle(s, 0, 0, 4, C.red, 1);
  dot.style.display = "none";
  const tt = makeTooltip(parent);
  s.addEventListener("mousemove", (e) => {
    const rect = s.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    if (svgX < P.l || svgX > W - P.r) {
      vl.style.display = "none";
      dot.style.display = "none";
      hideTooltip(tt);
      return;
    }
    const idx = Math.max(0, Math.min(Math.round((svgX - P.l) / W2 * (data.length - 1)), data.length - 1));
    const d = data[idx];
    const cx = sx(idx), cy = sy(d.value);
    vl.setAttribute("x1", String(cx));
    vl.setAttribute("y1", String(P.t));
    vl.setAttribute("x2", String(cx));
    vl.setAttribute("y2", String(P.t + H2));
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    [vl, dot].forEach((el) => el.style.display = "");
    showTooltip(tt, e, (el) => {
      el.createEl("div", { text: d.date, attr: { style: `color:${C.muted};font-size:10px;margin-bottom:3px;font-weight:700;` } });
      el.createEl("div", { text: `${fmt(d.value, 2)}%`, attr: { style: `color:${C.red};font-size:14px;font-weight:700;` } });
    });
  });
  s.addEventListener("mouseleave", () => {
    vl.style.display = "none";
    dot.style.display = "none";
    hideTooltip(tt);
  });
}
function renderMonthlyBars(parent, data, trades, onShowTrades) {
  if (!data.length)
    return;
  const W = 500, H = 130, P = { t: 10, r: 10, b: 30, l: 70 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const barW = Math.max(8, W2 / data.length - 4);
  const midY = P.t + H2 / 2;
  const s = svg(parent, W, H);
  sLine(s, P.l, midY, W - P.r, midY, "rgba(255,255,255,0.08)");
  sText(s, P.l - 4, midY + 3, "$0", C.muted, 8, "end");
  sText(s, P.l - 4, P.t + 4, fmtUSD(maxAbs), C.muted, 8, "end");
  sText(s, P.l - 4, P.t + H2 - 2, fmtUSD(-maxAbs), C.muted, 8, "end");
  data.forEach((d, i) => {
    const x = P.l + i / data.length * W2 + (W2 / data.length - barW) / 2;
    const barH = Math.abs(d.pnl) / maxAbs * (H2 / 2);
    const isPos = d.pnl >= 0;
    const title = `${d.month}: ${fmtUSD(d.pnl)} (${d.count} trades)`;
    sRect(s, x, isPos ? midY - barH : midY, barW, barH, isPos ? C.green : C.red, 2, title);
    const mo = d.month.slice(5);
    sText(s, x + barW / 2, H - 5, mo, C.muted, 8);
  });
}
function renderStreak(parent, streak, trades, onShowTrades) {
  const wrap = div(parent, "display:flex;flex-direction:column;gap:12px;");
  const row5 = div(wrap, "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
  row5.createEl("span", { text: "Last 5:", attr: { style: `color:${C.muted};font-size:11px;font-weight:700;` } });
  const tt5 = makeTooltip(wrap);
  streak.last5.forEach(({ trade: t, is_winner: w }) => {
    const dot = row5.createEl("div", {
      text: w ? "W" : "L",
      attr: { style: `width:28px;height:28px;border-radius:50%;background:${w ? C.green : C.red};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;flex-shrink:0;cursor:pointer;` }
    });
    dot.addEventListener("mouseenter", (e) => {
      showTooltip(tt5, e, (el) => {
        el.createEl("div", { text: `${t.exit_date}  ${t.exit_time}`, attr: { style: `color:${C.muted};font-size:10px;margin-bottom:5px;font-weight:700;` } });
        const row = div(el, "display:flex;justify-content:space-between;gap:20px;");
        row.createEl("span", { text: `${t.symbol} ${t.dir.toUpperCase()}`, attr: { style: `color:${C.text};font-weight:700;` } });
        row.createEl("span", { text: fmtUSD(t.pnl), attr: { style: `color:${pc(t.pnl)};font-weight:700;` } });
        const row2 = div(el, "display:flex;justify-content:space-between;gap:20px;margin-top:3px;");
        row2.createEl("span", { text: t.strategy || "\u2014", attr: { style: `color:${C.muted};font-size:10px;` } });
        row2.createEl("span", { text: `${t.r_multiple}R \xB7 Grade ${t.grade}`, attr: { style: `color:${pc(t.r_multiple)};font-size:10px;` } });
      });
    });
    dot.addEventListener("mousemove", (e) => moveTooltip(tt5, e));
    dot.addEventListener("mouseleave", () => hideTooltip(tt5));
    dot.addEventListener("click", () => onShowTrades([t]));
  });
  if (!streak.last5.length)
    row5.createEl("span", { text: "No trades yet", attr: { style: `color:${C.faint};font-size:11px;` } });
  if (streak.last5.length >= 2) {
    const mConf = streak.momentum === "hot" ? { label: "\u{1F525} Hot", color: "#facc15", bg: "rgba(250,204,21,0.15)" } : streak.momentum === "cold" ? { label: "\u2744\uFE0F Cold", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" } : { label: "\u3030\uFE0F Mixed", color: C.muted, bg: "rgba(255,255,255,0.05)" };
    row5.createEl("span", { text: mConf.label, attr: { style: `color:${mConf.color};background:${mConf.bg};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;font-family:${F};` } });
  }
  const curLabel = streak.current_streak > 0 ? `${streak.current_streak} win streak \u{1F525}` : streak.current_streak < 0 ? `${Math.abs(streak.current_streak)} loss streak \u2744\uFE0F` : "No active streak";
  const curColor = streak.current_streak > 0 ? C.green : streak.current_streak < 0 ? C.red : C.muted;
  div(wrap, "").createEl("div", { text: curLabel, attr: { style: `color:${curColor};font-size:13px;font-weight:700;font-family:${F};` } });
  const records = div(wrap, "display:flex;gap:16px;");
  const rWin = div(records, `background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;flex:1;`);
  rWin.createEl("div", { text: "Longest Win Streak", attr: { style: `color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;` } });
  rWin.createEl("div", { text: `${streak.longest_win} trades`, attr: { style: `color:${C.green};font-size:18px;font-weight:700;font-family:${F};` } });
  const rLoss = div(records, `background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:10px 14px;flex:1;`);
  rLoss.createEl("div", { text: "Longest Loss Streak", attr: { style: `color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;` } });
  rLoss.createEl("div", { text: `${streak.longest_loss} trades`, attr: { style: `color:${C.red};font-size:18px;font-weight:700;font-family:${F};` } });
}
function renderLargest(parent, stats, openFile) {
  var _a;
  const wrap = div(parent, "display:grid;grid-template-columns:1fr 1fr;gap:12px;");
  const makeCard = (label, trade, pnl, color, bg) => {
    const c = div(wrap, `background:${bg};border:1px solid ${color}33;border-radius:10px;padding:14px;`);
    c.createEl("div", { text: label, attr: { style: `color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:${F};` } });
    if (!trade) {
      c.createEl("div", { text: "No trades yet", attr: { style: `color:${C.faint};font-size:11px;` } });
      return;
    }
    c.createEl("div", { text: fmtUSD(pnl), attr: { style: `color:${color};font-size:24px;font-weight:700;font-family:${F};margin-bottom:4px;` } });
    const meta = div(c, "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;");
    meta.createEl("span", { text: trade.symbol, attr: { style: `color:${C.text};font-weight:700;font-size:12px;font-family:${F};` } });
    meta.createEl("span", { text: trade.strategy || "\u2014", attr: { style: `color:${C.muted};font-size:11px;` } });
    meta.createEl("span", { text: trade.exit_date, attr: { style: `color:${C.faint};font-size:11px;` } });
    const link = c.createEl("div", { text: "\u2192 Open note", attr: { style: `color:${C.blue};font-size:10px;cursor:pointer;margin-top:6px;font-family:${F};` } });
    link.addEventListener("click", () => openFile(trade.exit_file));
  };
  makeCard("Largest Win", stats.largest_win_trade, stats.largest_win, C.green, "rgba(74,222,128,0.06)");
  makeCard("Largest Loss", stats.largest_loss_trade, -((_a = stats.largest_loss) != null ? _a : 0), C.red, "rgba(248,113,113,0.06)");
}
function renderCalendar(parent, daily, weekly, trades, openFile, onShowTrades) {
  if (!daily.length) {
    parent.createEl("div", { text: "No trades yet", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const byDate = {};
  daily.forEach((d) => {
    byDate[d.date] = { pnl: d.pnl, count: d.count };
  });
  const tradesByDate = {};
  trades.forEach((t) => {
    if (!tradesByDate[t.exit_date])
      tradesByDate[t.exit_date] = [];
    tradesByDate[t.exit_date].push(t);
  });
  const byWeek = {};
  weekly.forEach((w) => {
    byWeek[w.week] = { pnl: w.pnl, count: w.count };
  });
  const maxAbs = Math.max(...Object.values(byDate).map((v) => Math.abs(v.pnl)), 1);
  const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  let curY = now.getFullYear(), curM = now.getMonth() + 1;
  function wKey(y, m, d) {
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay(), off = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(y, m - 1, d + off);
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }
  const wrap = div(parent, "");
  const tt = makeTooltip(parent);
  function renderMonth(y, m) {
    wrap.empty();
    const hdr = div(wrap, "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;");
    const prevBtn = hdr.createEl("button", { text: "\u2190", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;` } });
    hdr.createEl("div", { text: `${MN[m - 1]} ${y}`, attr: { style: `color:${C.text};font-size:15px;font-weight:700;font-family:${F};` } });
    const nextBtn = hdr.createEl("button", { text: "\u2192", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;` } });
    prevBtn.addEventListener("click", () => {
      if (m === 1) {
        curY--;
        curM = 12;
      } else {
        curM--;
      }
      renderMonth(curY, curM);
    });
    nextBtn.addEventListener("click", () => {
      if (m === 12) {
        curY++;
        curM = 1;
      } else {
        curM++;
      }
      renderMonth(curY, curM);
    });
    const grid = div(wrap, "display:grid;grid-template-columns:repeat(7,1fr) 90px;gap:4px;");
    DN.forEach((d) => grid.createEl("div", { text: d, attr: { style: `color:${C.muted};font-size:10px;text-align:center;padding:4px 0;font-family:${F};font-weight:700;` } }));
    grid.createEl("div", { text: "WEEK", attr: { style: `color:${C.muted};font-size:10px;text-align:center;padding:4px 0;font-family:${F};font-weight:700;` } });
    const firstDay = new Date(y, m - 1, 1);
    const startDow = firstDay.getDay();
    const startOff = startDow === 0 ? -6 : 1 - startDow;
    const dim = new Date(y, m, 0).getDate();
    const totalWeeks = Math.ceil((dim + (startDow === 0 ? 6 : startDow - 1)) / 7);
    for (let w = 0; w < totalWeeks; w++) {
      const wOff = startOff + w * 7;
      const wDate = new Date(y, m - 1, 1 + wOff);
      const wk = wKey(wDate.getFullYear(), wDate.getMonth() + 1, wDate.getDate());
      for (let d = 0; d < 7; d++) {
        const dayNum = 1 + wOff + d;
        const inMonth = dayNum >= 1 && dayNum <= dim;
        const ds = inMonth ? `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : "";
        const data = ds ? byDate[ds] : void 0;
        const cell = div(grid, `border-radius:6px;padding:6px;min-height:64px;position:relative;font-family:${F};`);
        if (!inMonth) {
          cell.style.background = "transparent";
          continue;
        }
        if (data) {
          const intensity = Math.min(Math.abs(data.pnl) / maxAbs, 1);
          const alpha = 0.2 + intensity * 0.7;
          cell.style.background = data.pnl >= 0 ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`;
          cell.style.cursor = "pointer";
          const dayEl = cell.createEl("div", { text: String(dayNum), attr: { style: `color:rgba(255,255,255,0.8);font-size:10px;font-weight:700;cursor:pointer;` } });
          dayEl.addEventListener("click", (e) => {
            var _a;
            e.stopPropagation();
            const dayTrades = (_a = tradesByDate[ds]) != null ? _a : [];
            if (dayTrades.length)
              openFile(dayTrades[0].exit_file);
          });
          cell.createEl("div", { text: fmtUSD(data.pnl), attr: { style: `color:#fff;font-size:11px;font-weight:700;margin-top:3px;` } });
          const countEl = cell.createEl("div", { text: `${data.count} trade${data.count !== 1 ? "s" : ""}`, attr: { style: `color:rgba(255,255,255,0.75);font-size:9px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;` } });
          countEl.addEventListener("click", (e) => {
            var _a;
            e.stopPropagation();
            onShowTrades((_a = tradesByDate[ds]) != null ? _a : []);
          });
          cell.addEventListener("mouseenter", (e) => {
            showTooltip(tt, e, (el) => {
              var _a;
              el.createEl("div", { text: ds, attr: { style: `color:${C.muted};font-size:10px;margin-bottom:6px;font-weight:700;` } });
              ((_a = tradesByDate[ds]) != null ? _a : []).forEach((t) => {
                const row = div(el, "display:flex;justify-content:space-between;gap:16px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);");
                row.createEl("span", { text: `${t.symbol} ${t.dir.toUpperCase()}`, attr: { style: `color:${C.text};font-weight:700;` } });
                row.createEl("span", { text: fmtUSD(t.pnl), attr: { style: `color:${pc(t.pnl)};font-weight:700;` } });
              });
              const tot = div(el, "display:flex;justify-content:space-between;margin-top:6px;padding-top:4px;");
              tot.createEl("span", { text: "Total", attr: { style: `color:${C.muted};font-size:10px;` } });
              tot.createEl("span", { text: fmtUSD(data.pnl), attr: { style: `color:${pc(data.pnl)};font-weight:700;` } });
            });
          });
          cell.addEventListener("mousemove", (e) => moveTooltip(tt, e));
          cell.addEventListener("mouseleave", () => hideTooltip(tt));
        } else {
          cell.style.background = "rgba(255,255,255,0.03)";
          cell.createEl("div", { text: String(dayNum), attr: { style: `color:${C.muted};font-size:10px;font-weight:700;` } });
        }
      }
      const wkData = byWeek[wk];
      const wkCell = div(grid, `border-radius:6px;padding:8px;min-height:64px;font-family:${F};`);
      if (wkData) {
        const isP = wkData.pnl >= 0;
        wkCell.style.background = isP ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)";
        wkCell.style.border = `1px solid ${isP ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`;
        wkCell.createEl("div", { text: "WEEK", attr: { style: `color:${C.muted};font-size:9px;font-weight:700;` } });
        wkCell.createEl("div", { text: fmtUSD(wkData.pnl), attr: { style: `color:${isP ? C.green : C.red};font-size:12px;font-weight:700;margin-top:4px;` } });
        const wkTrades = trades.filter((t) => wk === wKey(...t.exit_date.split("-").map(Number)));
        const wkCount = wkCell.createEl("div", { text: `${wkData.count} trades`, attr: { style: `color:${C.muted};font-size:9px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;` } });
        wkCount.addEventListener("click", () => onShowTrades(wkTrades));
      } else {
        wkCell.style.background = "rgba(255,255,255,0.02)";
      }
    }
  }
  renderMonth(curY, curM);
}
function renderTimeSlots(parent, data) {
  const active = data.filter((d) => d.winners + d.losers > 0);
  if (!active.length) {
    parent.createEl("div", { text: "No trades in 13:00\u201322:00", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const maxTotal = Math.max(...data.map((d) => d.winners + d.losers), 1);
  const maxPnlAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const W = 600, H = 160, P = { t: 10, r: 10, b: 40, l: 10 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const barW = Math.floor(W2 / data.length) - 2;
  const midY = P.t + H2 * 0.5;
  const s = svg(parent, W, H);
  sLine(s, P.l, midY, W - P.r, midY, "rgba(255,255,255,0.06)");
  data.forEach((d, i) => {
    const x = P.l + i / data.length * W2;
    const total = d.winners + d.losers;
    const isP = d.pnl >= 0;
    const intensity = total > 0 ? Math.min(Math.abs(d.pnl) / maxPnlAbs, 1) : 0;
    const alpha = 0.15 + intensity * 0.75;
    if (total > 0) {
      const barH = Math.abs(d.pnl) / maxPnlAbs * (H2 * 0.4);
      sRect(s, x, isP ? midY - barH : midY, barW, barH, isP ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`, 2, `${d.slot}: ${fmtUSD(d.pnl)}`);
      const wH = d.winners > 0 ? d.winners / maxTotal * (H2 * 0.45) : 0;
      const lH = d.losers > 0 ? d.losers / maxTotal * (H2 * 0.45) : 0;
      if (wH > 0)
        sRect(s, x + barW * 0.1, midY - H2 * 0.5, barW * 0.35, wH, C.green, 2, `Winners: ${d.winners}`);
      if (lH > 0)
        sRect(s, x + barW * 0.55, midY - H2 * 0.5, barW * 0.35, lH, C.red, 2, `Losers: ${d.losers}`);
      if (total > 0)
        sText(s, x + barW / 2, midY - H2 * 0.5 - 4, String(total), C.muted, 8);
    }
    if (i % 2 === 0) {
      sText(s, x + barW / 2, H - 5, d.slot.slice(0, 5), C.muted, 7);
    }
  });
  const legend = div(parent, "display:flex;gap:16px;margin-top:6px;");
  legend.createEl("span", { text: "\u25AC P&L bar", attr: { style: `color:${C.muted};font-size:10px;` } });
  legend.createEl("span", { text: "\u25A0 Winners", attr: { style: `color:${C.green};font-size:10px;` } });
  legend.createEl("span", { text: "\u25A0 Losers", attr: { style: `color:${C.red};font-size:10px;` } });
}
function renderDuration(parent, data) {
  const maxVal = Math.max(...data.map((d) => d.winners + d.losers), 1);
  const W = 300, fullH = data.length * 46 + 20, barW = W - 80;
  const s = svg(parent, W, fullH);
  data.forEach((d, i) => {
    const y = 10 + i * 46;
    sText(s, 0, y + 14, d.bucket, C.muted, 9, "start");
    const wW = d.winners > 0 ? d.winners / maxVal * barW : 0;
    const lW = d.losers > 0 ? d.losers / maxVal * barW : 0;
    sRect(s, 50, y, wW, 14, C.green, 3, `Winners: ${d.winners}`);
    sRect(s, 50, y + 18, lW, 14, C.red, 3, `Losers: ${d.losers}`);
    if (d.winners > 0)
      sText(s, 50 + wW + 4, y + 11, String(d.winners), C.green, 9, "start");
    if (d.losers > 0)
      sText(s, 50 + lW + 4, y + 11 + 18, String(d.losers), C.red, 9, "start");
  });
}
function renderStrategyTable(parent, stats, trades, onShowTrades) {
  const strategies = Object.values(stats.pnl_by_strategy);
  if (!strategies.length) {
    parent.createEl("div", { text: "No strategy data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  let sortKey = "net_pnl";
  let sortAsc = false;
  const cols = [
    { label: "Strategy", key: "strategy" },
    { label: "Trades", key: "trade_count" },
    { label: "Win %", key: "win_rate" },
    { label: "P. Factor", key: "profit_factor" },
    { label: "Avg R", key: "avg_r" },
    { label: "Net P&L", key: "net_pnl" }
  ];
  const table = parent.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:12px;font-family:${F};` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const renderHeader = () => {
    thead.empty();
    const hr = thead.createEl("tr", { attr: { style: `background:var(--background-primary);` } });
    cols.forEach((col) => {
      const isAct = col.key === sortKey;
      const arr = isAct ? sortAsc ? " \u2191" : " \u2193" : " \u2195";
      const th = hr.createEl("th", { text: col.label + arr, attr: { style: `color:${isAct ? C.blue : C.muted};text-align:left;padding:6px 10px;border-bottom:1px solid ${C.border};font-weight:700;font-size:10px;letter-spacing:1px;white-space:nowrap;cursor:pointer;user-select:none;` } });
      th.addEventListener("click", () => {
        if (sortKey === col.key)
          sortAsc = !sortAsc;
        else {
          sortKey = col.key;
          sortAsc = false;
        }
        renderHeader();
        renderRows();
      });
    });
  };
  const renderRows = () => {
    tbody.empty();
    const sorted = [...strategies].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    sorted.forEach((s) => {
      const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid ${C.border};` } });
      tr.addEventListener("mouseenter", () => tr.style.background = "rgba(255,255,255,0.02)");
      tr.addEventListener("mouseleave", () => tr.style.background = "");
      const stTrades = trades.filter((t) => t.strategy === s.strategy);
      const cells = [
        { v: s.strategy, c: C.text, bold: true },
        { v: String(s.trade_count), c: C.blue, click: () => onShowTrades(stTrades) },
        { v: `${s.win_rate}%`, c: s.win_rate >= 50 ? C.green : C.red },
        { v: s.profit_factor === Infinity ? "\u221E" : String(s.profit_factor), c: s.profit_factor >= 1 ? C.green : C.red },
        { v: String(s.avg_r), c: s.avg_r >= 0 ? C.green : C.red },
        { v: fmtUSD(s.net_pnl), c: pc(s.net_pnl), bold: true }
      ];
      cells.forEach((cell) => {
        const td = tr.createEl("td", { attr: { style: `padding:8px 10px;` } });
        const span = td.createEl("span", { text: cell.v, attr: { style: `color:${cell.c};${cell.bold ? "font-weight:700;" : ""}${cell.click ? "cursor:pointer;text-decoration:underline;text-underline-offset:2px;" : ""}` } });
        if (cell.click)
          span.addEventListener("click", cell.click);
      });
    });
  };
  renderHeader();
  renderRows();
}
function renderGrades(parent, stats, trades, onShowTrades) {
  const gColors = { A: C.green, B: C.blue, C: C.yellow, D: C.red };
  const wrap = div(parent, "display:grid;grid-template-columns:repeat(4,1fr);gap:8px;");
  Object.values(stats.pnl_by_grade).forEach((g) => {
    const c = card(wrap, "padding:12px;");
    c.createEl("div", { text: `Grade ${g.grade}`, attr: { style: `color:${gColors[g.grade]};font-size:14px;font-weight:700;font-family:${F};` } });
    const gTrades = trades.filter((t) => t.grade === g.grade);
    const countEl = c.createEl("div", { text: `${g.trade_count} trades`, attr: { style: `color:${C.blue};font-size:10px;margin-top:2px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-family:${F};` } });
    countEl.addEventListener("click", () => onShowTrades(gTrades));
    c.createEl("div", { text: fmtUSD(g.net_pnl), attr: { style: `color:${pc(g.net_pnl)};font-size:16px;font-weight:700;margin-top:6px;font-family:${F};` } });
    c.createEl("div", { text: `WR: ${g.win_rate}% \xB7 Avg R: ${g.avg_r}`, attr: { style: `color:${C.muted};font-size:10px;margin-top:2px;font-family:${F};` } });
  });
}
function renderCorrelation(parent, data, chartW = 500) {
  if (data.length < 3) {
    const msg = div(parent, "");
    msg.createEl("div", { text: `${data.length} trades have market score data (need at least 3).`, attr: { style: `color:${C.muted};font-size:11px;margin-bottom:6px;` } });
    msg.createEl("div", { text: "To populate this chart: open each daily note in Live Preview so the Dataview block writes the 'score' frontmatter value, then rebuild the cache.", attr: { style: `color:${C.faint};font-size:10px;` } });
    return;
  }
  const W = chartW, H = Math.round(chartW * 0.28), P = { t: 10, r: 10, b: 28, l: 70 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const pnls = data.map((d) => d.pnl);
  const minP = Math.min(...pnls), maxP = Math.max(...pnls), rangeP = maxP - minP || 1;
  const midY = P.t + H2 / 2;
  const sx = (sc) => P.l + sc / 100 * W2;
  const sy = (p) => P.t + H2 - (p - minP) / rangeP * H2;
  const s = svg(parent, W, H);
  sLine(s, P.l, midY, W - P.r, midY, "rgba(255,255,255,0.05)");
  sText(s, P.l - 4, midY + 3, "$0", C.muted, 8, "end");
  const xMarkers = [0, 15, 30, 50, 75, 100];
  xMarkers.forEach((v) => {
    const x = P.l + v / 100 * W2;
    sLine(s, x, P.t, x, P.t + H2, "rgba(255,255,255,0.04)");
    sText(s, x, H - 5, String(v), C.muted, 8);
  });
  sText(s, W / 2, H - 5, "", C.muted, 9, "middle");
  data.forEach((d) => {
    sCircle(s, sx(d.score), sy(d.pnl), 5, pc(d.pnl), 0.7, `${d.date} ${d.symbol}: Score ${d.score}, P&L ${fmtUSD(d.pnl)}`);
  });
}
function renderTradesList(parent, trades, openFile) {
  if (!trades.length) {
    parent.createEl("div", { text: "No trades for this period", attr: { style: `color:${C.muted};font-size:12px;padding:24px;text-align:center;font-family:${F};` } });
    return;
  }
  let sortKey = "entry_date";
  let sortAsc = false;
  const cols = [
    { label: "Open", key: "entry_date" },
    { label: "Symbol", key: "symbol" },
    { label: "Status" },
    { label: "Close", key: "exit_date" },
    { label: "Entry" },
    { label: "Avg Exit" },
    { label: "Entry Shares", key: "entry_size" },
    { label: "Shares", key: "filled_size" },
    { label: "Net P&L", key: "pnl" },
    { label: "ROI", key: "pnl_pct" },
    { label: "R", key: "r_multiple" },
    { label: "Trade P&L", key: "trade_total_pnl" },
    { label: "Trade ROI", key: "trade_total_pnl_pct" },
    { label: "Trade R", key: "trade_total_r" },
    { label: "Side" },
    { label: "Strategy", key: "strategy" },
    { label: "Grade", key: "grade" },
    { label: "Days", key: "hold_days" },
    { label: "Exits" }
  ];
  const wrap = div(parent, "overflow-x:auto;");
  const table = wrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:12px;font-family:${F};` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const renderHeader = () => {
    thead.empty();
    const hr = thead.createEl("tr", { attr: { style: `background:var(--background-secondary);position:sticky;top:0;z-index:1;` } });
    cols.forEach((col) => {
      const isActive = col.key === sortKey;
      const arrow = col.key ? isActive ? sortAsc ? " \u2191" : " \u2193" : " \u2195" : "";
      const th = hr.createEl("th", { text: col.label + arrow, attr: { style: `color:${isActive ? C.blue : C.muted};text-align:left;padding:8px 10px;border-bottom:1px solid ${C.border};font-weight:700;font-size:10px;letter-spacing:1px;white-space:nowrap;${col.key ? "cursor:pointer;user-select:none;" : ""}` } });
      if (col.key) {
        const k = col.key;
        th.addEventListener("click", () => {
          if (sortKey === k)
            sortAsc = !sortAsc;
          else {
            sortKey = k;
            sortAsc = false;
          }
          renderHeader();
          renderRows();
        });
      }
    });
  };
  const aggregateByBase = /* @__PURE__ */ new Map();
  trades.forEach((t) => {
    var _a;
    const baseId = t.trade_id.replace(/#\d+$/, "");
    const cur = (_a = aggregateByBase.get(baseId)) != null ? _a : { pnl: 0, filled: 0, exitCount: 0, entryPrice: t.entry_price, entrySize: t.entry_size, targetSl: t.target_sl };
    cur.pnl += t.pnl;
    cur.filled += t.filled_size;
    cur.exitCount = Math.max(cur.exitCount, t.exit_count);
    aggregateByBase.set(baseId, cur);
  });
  const getTradeTotals = (t) => {
    var _a, _b, _c;
    const baseId = t.trade_id.replace(/#\d+$/, "");
    const agg = aggregateByBase.get(baseId);
    const totalPnl = (_a = agg == null ? void 0 : agg.pnl) != null ? _a : t.pnl;
    const totalPnlPct = agg && agg.entryPrice * agg.entrySize > 0 ? totalPnl / (agg.entryPrice * agg.entrySize) * 100 : 0;
    const riskPerUnit = Math.abs(((_b = agg == null ? void 0 : agg.entryPrice) != null ? _b : t.entry_price) - ((_c = agg == null ? void 0 : agg.targetSl) != null ? _c : t.target_sl));
    const totalR = agg && riskPerUnit > 0 && agg.entrySize > 0 ? totalPnl / (riskPerUnit * agg.entrySize) : 0;
    return { totalPnl, totalPnlPct, totalR };
  };
  const getSortVal = (t, k) => {
    const totals = getTradeTotals(t);
    if (k === "entry_date")
      return t.entry_date;
    if (k === "exit_date")
      return t.exit_date;
    if (k === "symbol")
      return t.symbol;
    if (k === "entry_size")
      return t.entry_size;
    if (k === "filled_size")
      return t.filled_size;
    if (k === "pnl")
      return t.pnl;
    if (k === "pnl_pct")
      return t.pnl_pct;
    if (k === "r_multiple")
      return t.r_multiple;
    if (k === "trade_total_pnl")
      return totals.totalPnl;
    if (k === "trade_total_pnl_pct")
      return totals.totalPnlPct;
    if (k === "trade_total_r")
      return totals.totalR;
    if (k === "strategy")
      return t.strategy || "";
    if (k === "grade")
      return t.grade;
    if (k === "hold_days")
      return t.hold_days;
    return "";
  };
  const renderRows = () => {
    tbody.empty();
    const sorted = [...trades].sort((a, b) => {
      const av = getSortVal(a, sortKey), bv = getSortVal(b, sortKey);
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    const gC = { A: C.green, B: C.blue, C: C.yellow, D: C.red };
    sorted.forEach((t) => {
      const totals = getTradeTotals(t);
      const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid ${C.border};cursor:pointer;` } });
      tr.addEventListener("mouseenter", () => tr.style.background = "rgba(255,255,255,0.02)");
      tr.addEventListener("mouseleave", () => tr.style.background = "");
      tr.addEventListener("click", () => openFile(t.exit_file));
      const sLabel = t.is_partial ? "PARTIAL" : t.is_winner ? "WIN" : "LOSS";
      const sBg = t.is_partial ? "rgba(250,204,21,0.15)" : t.is_winner ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)";
      const sC = t.is_partial ? C.yellow : t.is_winner ? C.green : C.red;
      [
        { v: t.entry_date, c: C.muted },
        { v: t.symbol, c: C.text, bold: true },
        { v: sLabel, c: sC, bg: sBg, pill: true },
        { v: t.exit_date, c: C.muted },
        { v: `$${t.entry_price}`, c: C.text },
        { v: `$${t.exit_price}`, c: C.text },
        { v: String(t.entry_size), c: C.text },
        { v: String(t.filled_size), c: C.text },
        { v: fmtUSD(t.pnl), c: pc(t.pnl), bold: true },
        { v: `${fmt(t.pnl_pct, 2)}%`, c: pc(t.pnl) },
        { v: `${t.r_multiple}R`, c: pc(t.r_multiple) },
        { v: fmtUSD(totals.totalPnl), c: pc(totals.totalPnl), bold: true },
        { v: `${fmt(totals.totalPnlPct, 2)}%`, c: pc(totals.totalPnl) },
        { v: `${fmt(totals.totalR, 2)}R`, c: pc(totals.totalR) },
        { v: t.dir.toUpperCase(), c: t.dir === "long" ? C.blue : C.orange },
        { v: t.strategy || "\u2014", c: C.muted },
        { v: t.grade, c: gC[t.grade] },
        { v: String(t.hold_days), c: C.muted },
        { v: String(t.exit_count), c: C.muted }
      ].forEach((cell) => {
        const td = tr.createEl("td", { attr: { style: `padding:9px 10px;white-space:nowrap;` } });
        if (cell.pill) {
          badge(td, cell.v, cell.c, cell.bg);
        } else {
          td.createEl("span", { text: cell.v, attr: { style: `color:${cell.c};${cell.bold ? "font-weight:700;" : ""}` } });
        }
      });
    });
  };
  renderHeader();
  renderRows();
}
function uniqueTradeDirStats(trades) {
  const byId = /* @__PURE__ */ new Map();
  trades.forEach((t) => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    if (!byId.has(baseId))
      byId.set(baseId, t.dir);
  });
  const total = byId.size;
  const longCount = [...byId.values()].filter((v) => v === "long").length;
  const shortCount = [...byId.values()].filter((v) => v === "short").length;
  return {
    longPct: total ? parseFloat((longCount / total * 100).toFixed(1)) : 0,
    shortPct: total ? parseFloat((shortCount / total * 100).toFixed(1)) : 0,
    total
  };
}
function renderStatsBar(parent, stats, trades, openAnalytics, onShowTrades, openFile) {
  const wrap = div(parent, `display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:12px 16px;`);
  const dirStats = uniqueTradeDirStats(trades);
  const items = [
    { label: "Net P&L", value: fmtUSD(stats.net_pnl), color: pc(stats.net_pnl) },
    { label: "Net+Unreal", value: fmtUSD(stats.net_pnl + openAnalytics.totalUnrealizedPnl), color: pc(stats.net_pnl + openAnalytics.totalUnrealizedPnl) },
    { label: "Win Rate", value: `${stats.win_rate}%`, color: stats.win_rate >= 50 ? C.green : C.red },
    { label: "Profit Factor", value: stats.profit_factor === Infinity ? "\u221E" : String(stats.profit_factor), color: stats.profit_factor >= 1 ? C.green : C.red },
    { label: "Day Win %", value: `${stats.day_win_rate}%`, color: stats.day_win_rate >= 50 ? C.green : C.red },
    { label: "Avg Win", value: fmtUSD(stats.avg_win), color: C.green },
    { label: "Avg Loss", value: fmtUSD(stats.avg_loss), color: C.red },
    { label: "Largest Win", value: fmtUSD(stats.largest_win), color: C.green, click: () => stats.largest_win_trade && openFile(stats.largest_win_trade.exit_file) },
    { label: "Largest Loss", value: fmtUSD(-stats.largest_loss), color: C.red, click: () => stats.largest_loss_trade && openFile(stats.largest_loss_trade.exit_file) },
    { label: "Avg W/L Ratio", value: String(stats.avg_win_loss_ratio), color: stats.avg_win_loss_ratio >= 1 ? C.green : C.red, extra: stats.avg_win > 0 || stats.avg_loss > 0 ? { win: stats.avg_win, loss: stats.avg_loss } : null },
    { label: "Avg R", value: `${stats.avg_r_multiple}R`, color: stats.avg_r_multiple >= 0 ? C.green : C.red },
    { label: "Avg R Win", value: `${stats.avg_r_win}R`, color: C.green },
    { label: "Avg R Loss", value: `${stats.avg_r_loss}R`, color: C.red },
    { label: "Gain to Pain", value: stats.gain_to_pain === Infinity ? "\u221E" : String(stats.gain_to_pain), color: stats.gain_to_pain >= 1 ? C.green : C.red },
    { label: "Max DD", value: `${stats.max_drawdown_pct.toFixed(1)}%`, color: C.red },
    { label: "ROI", value: `${stats.overall_roi}%`, color: pc(stats.overall_roi) },
    { label: "Balance", value: fmtUSD(stats.current_balance), color: C.blue },
    { label: "Bal+Unreal", value: fmtUSD(stats.current_balance + openAnalytics.totalUnrealizedPnl), color: C.blue },
    { label: "Long %", value: `${dirStats.longPct}%`, color: dirStats.longPct >= 50 ? C.green : C.text },
    { label: "Short %", value: `${dirStats.shortPct}%`, color: dirStats.shortPct >= 50 ? C.red : C.text },
    { label: "Unrealized R", value: `${openAnalytics.totalUnrealizedR}R`, color: openAnalytics.totalUnrealizedR >= 0 ? C.green : C.red },
    { label: "Open Risk", value: fmtUSD(openAnalytics.totalOpenRiskToStop), color: C.orange },
    { label: "Trades", value: `${stats.trade_count} (${stats.exit_count} exits)`, color: C.text, click: () => onShowTrades(trades) }
  ];
  items.forEach((item) => {
    const c = div(wrap, `background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:10px;`);
    c.createEl("div", { text: item.label, attr: { style: `color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-family:${F};` } });
    const valEl = c.createEl("div", { text: item.value, attr: { style: `color:${item.color};font-size:18px;font-weight:700;font-family:${F};${item.click ? "cursor:pointer;text-decoration:underline;text-underline-offset:3px;" : ""}` } });
    if (item.click)
      valEl.addEventListener("click", item.click);
    if (item.extra) {
      const barWrap = div(c, "display:flex;align-items:center;gap:4px;margin-top:6px;");
      const total = item.extra.win + item.extra.loss;
      const winPct = total > 0 ? item.extra.win / total * 100 : 50;
      const bar = div(barWrap, `flex:1;height:6px;border-radius:3px;overflow:hidden;display:flex;`);
      div(bar, `width:${winPct}%;background:${C.green};`);
      div(bar, `flex:1;background:${C.red};`);
      barWrap.createEl("span", { text: `$${item.extra.win.toFixed(0)}`, attr: { style: `color:${C.green};font-size:9px;font-weight:700;font-family:${F};` } });
      barWrap.createEl("span", { text: `-$${item.extra.loss.toFixed(0)}`, attr: { style: `color:${C.red};font-size:9px;font-weight:700;font-family:${F};` } });
    }
  });
}
function renderFilters(parent, trades, filters, onChange) {
  var _a, _b, _c, _d, _e, _f, _g;
  const wrap = div(parent, `display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:${C.card};border-bottom:1px solid ${C.border};`);
  const selSt = `background:var(--background-primary);color:${C.text};border:1px solid ${C.border};border-radius:6px;padding:5px 8px;font-size:11px;font-family:${F};cursor:pointer;`;
  const btnSt = `background:var(--background-primary);color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:${F};`;
  const actSt = `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:${F};`;
  const strategies = [...new Set(trades.map((t) => t.strategy).filter(Boolean))];
  const accounts = [...new Set(trades.map((t) => t.account).filter(Boolean))];
  const symbols = [...new Set(trades.map((t) => t.symbol).filter(Boolean))];
  const monthStartIso = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  };
  const ytdStartIso = () => {
    const d = new Date();
    d.setMonth(0);
    d.setDate(1);
    return d.toISOString().split("T")[0];
  };
  const presets = [
    { label: "All", days: 0 },
    { label: "1W", days: 7 },
    { label: "MTD", days: -2 },
    { label: "1M", days: 30 },
    { label: "3M", days: 90 },
    { label: "6M", days: 180 },
    { label: "YTD", days: -1 }
  ];
  const isActive = (days) => {
    if (days === 0)
      return !filters.date_from && !filters.date_to;
    if (days === -1)
      return filters.date_from === ytdStartIso() && !filters.date_to;
    if (days === -2)
      return filters.date_from === monthStartIso() && !filters.date_to;
    const from = new Date();
    from.setDate(from.getDate() - days);
    return filters.date_from === from.toISOString().split("T")[0] && !filters.date_to;
  };
  presets.forEach((p) => {
    const btn = wrap.createEl("button", { text: p.label, attr: { style: isActive(p.days) ? actSt : btnSt } });
    btn.addEventListener("click", () => {
      if (p.days === 0) {
        onChange(__spreadProps(__spreadValues({}, filters), { date_from: void 0, date_to: void 0 }));
      } else if (p.days === -1) {
        onChange(__spreadProps(__spreadValues({}, filters), { date_from: ytdStartIso(), date_to: void 0 }));
      } else if (p.days === -2) {
        onChange(__spreadProps(__spreadValues({}, filters), { date_from: monthStartIso(), date_to: void 0 }));
      } else {
        const from = new Date();
        from.setDate(from.getDate() - p.days);
        onChange(__spreadProps(__spreadValues({}, filters), { date_from: from.toISOString().split("T")[0], date_to: void 0 }));
      }
    });
  });
  const fromIn = wrap.createEl("input", { attr: { type: "date", value: (_a = filters.date_from) != null ? _a : "", style: selSt } });
  fromIn.addEventListener("change", () => onChange(__spreadProps(__spreadValues({}, filters), { date_from: fromIn.value || void 0 })));
  wrap.createEl("span", { text: "\u2192", attr: { style: `color:${C.muted};font-size:11px;` } });
  const toIn = wrap.createEl("input", { attr: { type: "date", value: (_b = filters.date_to) != null ? _b : "", style: selSt } });
  toIn.addEventListener("change", () => onChange(__spreadProps(__spreadValues({}, filters), { date_to: toIn.value || void 0 })));
  const mkSel = (label, opts, val, key) => {
    const sel = wrap.createEl("select", { attr: { style: selSt } });
    sel.createEl("option", { text: label, attr: { value: "" } });
    opts.forEach((o) => {
      const op = sel.createEl("option", { text: o, attr: { value: o } });
      if (val === o)
        op.setAttribute("selected", "true");
    });
    sel.addEventListener("change", () => onChange(__spreadProps(__spreadValues({}, filters), { [key]: sel.value || void 0 })));
  };
  mkSel("All Accounts", accounts, (_c = filters.account) != null ? _c : "", "account");
  mkSel("All Strategies", strategies, (_d = filters.strategy) != null ? _d : "", "strategy");
  mkSel("All Grades", ["A", "B", "C", "D"], (_e = filters.grade) != null ? _e : "", "grade");
  mkSel("Long/Short", ["long", "short"], (_f = filters.dir) != null ? _f : "", "dir");
  mkSel("All Symbols", symbols, (_g = filters.symbol) != null ? _g : "", "symbol");
  const rebuildBtn = wrap.createEl("button", { text: "\u27F3 Rebuild", attr: { style: `${btnSt}margin-left:auto;` } });
  rebuildBtn.addEventListener("click", () => {
    var _a2, _b2;
    rebuildBtn.textContent = "Building...";
    (_b2 = (_a2 = window.app) == null ? void 0 : _a2.commands) == null ? void 0 : _b2.executeCommandById("trading-journal:rebuild-trading-cache");
    setTimeout(() => {
      rebuildBtn.textContent = "\u27F3 Rebuild";
    }, 4e3);
  });
}
function valueStyle(color, extra = "") {
  return `color:${color};font-weight:700;${extra}`;
}
function rowPairStyles(left, right) {
  if (left > right)
    return [valueStyle(C.green), valueStyle(C.red)];
  if (left < right)
    return [valueStyle(C.red), valueStyle(C.green)];
  return ["color:var(--text-normal);font-weight:700;", "color:var(--text-normal);font-weight:700;"];
}
function metricCell(parent, label, value) {
  const m = card(parent, "padding:12px;");
  m.createEl("div", { text: label, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-family:${F};` } });
  m.createEl("div", { text: value, attr: { style: `color:${C.text};font-size:18px;font-weight:700;font-family:${F};` } });
}
function filterOpenRows(openRows, filters) {
  return openRows.filter((r) => {
    var _a, _b, _c;
    const grade = ((_a = r.trade_score) != null ? _a : 0) >= 40 ? "A" : ((_b = r.trade_score) != null ? _b : 0) >= 30 ? "B" : ((_c = r.trade_score) != null ? _c : 0) >= 15 ? "C" : "D";
    if (filters.date_from && r.date < filters.date_from)
      return false;
    if (filters.date_to && r.date > filters.date_to)
      return false;
    if (filters.account && r.account !== filters.account)
      return false;
    if (filters.strategy && r.strategy !== filters.strategy)
      return false;
    if (filters.dir && r.dir !== filters.dir)
      return false;
    if (filters.grade && grade !== filters.grade)
      return false;
    if (filters.symbol && r.symbol.toUpperCase() !== filters.symbol.toUpperCase())
      return false;
    return true;
  });
}
function polar(cx, cy, r, a) {
  const rad = (a - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutPath(cx, cy, rOuter, rInner, start, end) {
  const p1 = polar(cx, cy, rOuter, start);
  const p2 = polar(cx, cy, rOuter, end);
  const p3 = polar(cx, cy, rInner, end);
  const p4 = polar(cx, cy, rInner, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z"
  ].join(" ");
}
function renderOpenPositionDetails(parent, analytics, openFile) {
  if (!analytics.positions.length) {
    parent.createEl("div", { text: "No open positions", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const tableWrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = tableWrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:1120px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};` } });
  ["Symbol", "Initial Shares", "Current Shares", "Open Value", "Current Value", "Real %", "Unreal %", "Real R", "Unreal R", "Total R", "Last Close"].forEach((h) => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });
  analytics.positions.forEach((p) => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;` } });
    tr.addEventListener("click", () => openFile(p.entryFile));
    const cells = [
      { text: `${p.symbol} ${p.dir.toUpperCase()}`, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: fmt(p.entrySize, 0), style: `padding:8px;text-align:right;color:${C.text};` },
      { text: fmt(p.remainingSize, 0), style: `padding:8px;text-align:right;color:${C.text};font-weight:700;` },
      { text: fmtUSD(p.openingValue), style: `padding:8px;text-align:right;color:${C.text};` },
      { text: fmtUSD(p.currentValue), style: `padding:8px;text-align:right;color:${C.blue};font-weight:700;` },
      { text: `${p.realizedPct >= 0 ? "+" : ""}${fmt(p.realizedPct)}%`, style: `padding:8px;text-align:right;color:${pc(p.realizedPct)};font-weight:700;` },
      { text: `${p.unrealizedPct >= 0 ? "+" : ""}${fmt(p.unrealizedPct)}%`, style: `padding:8px;text-align:right;color:${pc(p.unrealizedPct)};font-weight:700;` },
      { text: `${p.realizedR}R`, style: `padding:8px;text-align:right;color:${p.realizedR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: `${p.unrealizedR}R`, style: `padding:8px;text-align:right;color:${p.unrealizedR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: `${p.totalR}R`, style: `padding:8px;text-align:right;color:${p.totalR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: p.latestClose ? `$${fmt(p.latestClose.close)}` : "\u2014", style: `padding:8px;text-align:right;color:${C.muted};` }
    ];
    cells.forEach((cell) => tr.createEl("td", { text: cell.text, attr: { style: cell.style } }));
  });
}
function renderOpenPositionsPie(parent, openRows, balance, openFile) {
  const grouped = /* @__PURE__ */ new Map();
  openRows.forEach((r) => {
    var _a, _b;
    const key = r.symbol;
    const current = grouped.get(key);
    const value = r.price * r.size;
    grouped.set(key, { label: key, value: ((_a = current == null ? void 0 : current.value) != null ? _a : 0) + value, filePath: (_b = current == null ? void 0 : current.filePath) != null ? _b : r.filePath });
  });
  const positions = [...grouped.values()].sort((a, b) => b.value - a.value);
  const openValue = positions.reduce((sum, p) => sum + p.value, 0);
  const cashValue = Math.max(0, balance - openValue);
  const slices = [...positions, { label: "Cash", value: cashValue, filePath: void 0 }].filter((s2) => s2.value > 0);
  const total = slices.reduce((sum, s2) => sum + s2.value, 0) || 1;
  const colors = [C.blue, C.green, C.purple, C.yellow, C.orange, "#f472b6", "#34d399", "#fb7185", "#22d3ee", "#c084fc", "#94a3b8"];
  const wrap = div(parent, "display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:18px;align-items:center;");
  const left = div(wrap, "display:flex;justify-content:center;");
  const legend = div(wrap, "display:flex;flex-direction:column;gap:8px;");
  const W = 260, H = 220, cx = 120, cy = 110, rOuter = 78, rInner = 44;
  const s = svg(left, W, H);
  const tt = makeTooltip(parent);
  let angle = 0;
  slices.forEach((slice, idx) => {
    const pct = slice.value / total;
    const start = angle;
    const end = angle + pct * 360;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", donutPath(cx, cy, rOuter, rInner, start, end));
    path.setAttribute("fill", colors[idx % colors.length]);
    path.style.cursor = slice.filePath ? "pointer" : "default";
    s.appendChild(path);
    path.addEventListener("mouseenter", (e) => showTooltip(tt, e, (el) => {
      el.createEl("div", { text: slice.label, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
      el.createEl("div", { text: `${fmtUSD(slice.value)} \xB7 ${fmt(pct * 100, 1)}%`, attr: { style: `color:${colors[idx % colors.length]};` } });
    }));
    path.addEventListener("mousemove", (e) => moveTooltip(tt, e));
    path.addEventListener("mouseleave", () => hideTooltip(tt));
    if (slice.filePath)
      path.addEventListener("click", () => openFile(slice.filePath));
    angle = end;
  });
  sText(s, cx, cy - 6, "Open", C.muted, 10, "middle");
  sText(s, cx, cy + 14, fmtUSD(openValue), C.text, 12, "middle");
  slices.forEach((slice, idx) => {
    const pct = slice.value / total;
    const row = div(legend, `display:grid;grid-template-columns:14px 1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);${slice.filePath ? "cursor:pointer;" : ""}`);
    row.createEl("div", { attr: { style: `width:10px;height:10px;border-radius:50%;background:${colors[idx % colors.length]};` } });
    row.createEl("div", { text: slice.label, attr: { style: `color:${C.text};font-size:11px;font-weight:700;font-family:${F};` } });
    row.createEl("div", { text: `${fmt(pct * 100, 1)}%`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });
    row.createEl("div", { text: fmtUSD(slice.value), attr: { style: `color:${C.text};font-size:11px;font-family:${F};` } });
    if (slice.filePath)
      row.addEventListener("click", () => openFile(slice.filePath));
  });
}
function filterByDateRange(rows, from, to) {
  return rows.filter((row) => (!from || row.dateIso >= from) && (!to || row.dateIso <= to));
}
function latestRows(rows, count) {
  return rows.slice(0, count);
}
function lastNDaysIso(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatChartTick(dateIso) {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m)
    return dateIso;
  return `${m[2]}-${m[3]}`;
}
function seriesSma(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period)
      continue;
    const slice = values.slice(i + 1 - period, i + 1);
    if (slice.some((v) => v === null))
      continue;
    const nums = slice;
    out[i] = nums.reduce((sum, value) => sum + value, 0) / period;
  }
  return out;
}
function chartPanel(parent) {
  return div(parent, `background:#10192d;border:1px solid rgba(148,163,184,0.18);border-radius:12px;padding:12px 12px 10px;`);
}
function drawXAxisTicks(s, dates, sx, y) {
  const tickCount = Math.min(5, dates.length);
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round(i / Math.max(tickCount - 1, 1) * (dates.length - 1));
    sText(s, sx(idx), y, formatChartTick(dates[idx]), C.faint, 8, "middle");
  }
}
function renderOscillatorHistogram(parent, data, footerLeft, footerLegend, chartW = 900) {
  if (!data.length) {
    parent.createEl("div", { text: "No data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const panel = chartPanel(parent);
  const W = chartW, H = Math.round(chartW * 0.26), P = { t: 10, r: 10, b: 28, l: 10 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const minV = Math.min(...data.map((d) => d.value), 0), maxV = Math.max(...data.map((d) => d.value), 0);
  const range = maxV - minV || 1;
  const zeroY = P.t + H2 - (0 - minV) / range * H2;
  const targetStep = Math.min(22, Math.max(12, W2 / Math.max(data.length, 1)));
  const drawWidth = Math.min(W2, Math.max(data.length * targetStep, data.length * 6));
  const startX = P.l + (W2 - drawWidth) / 2;
  const step = drawWidth / Math.max(data.length, 1);
  const bw = Math.max(5, Math.min(18, step * 0.94));
  const s = svg(panel, W, H);
  const tt = makeTooltip(panel);
  const cross = sLine(s, P.l, P.t, P.l, P.t + H2, "rgba(148,163,184,0.35)");
  cross.style.display = "none";
  sLine(s, P.l, zeroY, W - P.r, zeroY, "rgba(148,163,184,0.18)");
  [0.25, 0.5, 0.75].forEach((frac) => {
    const y = P.t + frac * H2;
    sLine(s, P.l, y, W - P.r, y, "rgba(148,163,184,0.08)");
  });
  data.forEach((d, i) => {
    const x = startX + i * step + (step - bw) / 2;
    const y = P.t + H2 - (d.value - minV) / range * H2;
    const top = Math.min(zeroY, y);
    const h = Math.max(1, Math.abs(zeroY - y));
    sRect(s, x, top, bw, h, d.value >= 0 ? "#35d2a0" : "#ff7d72", 1.5, `${d.date}: ${fmt(d.value, 0)}`);
    const hit = sRect(s, startX + i * step, P.t, Math.max(step, 6), H2, "transparent", 0);
    hit.style.cursor = "crosshair";
    const showBarTooltip = (e) => {
      cross.setAttribute("x1", String(x + bw / 2));
      cross.setAttribute("x2", String(x + bw / 2));
      cross.style.display = "block";
      showTooltip(tt, e, (el) => {
        el.createEl("div", { text: d.date, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
        el.createEl("div", { text: `Value: ${fmt(d.value, 0)}`, attr: { style: `color:${d.value >= 0 ? C.green : C.red};` } });
      });
    };
    hit.addEventListener("mouseenter", showBarTooltip);
    hit.addEventListener("mousemove", (e) => {
      showBarTooltip(e);
      moveTooltip(tt, e);
    });
    hit.addEventListener("mouseleave", () => {
      cross.style.display = "none";
      hideTooltip(tt);
    });
  });
  drawXAxisTicks(s, data.map((d) => d.date), (i) => startX + i * step + step / 2, H - 6);
  const footer = div(panel, "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;flex-wrap:wrap;");
  footer.createEl("div", { text: footerLeft != null ? footerLeft : "", attr: { style: `color:${C.text};font-size:11px;font-family:${F};font-weight:700;` } });
  if (footerLegend == null ? void 0 : footerLegend.length) {
    const legend = div(footer, "display:flex;gap:12px;align-items:center;flex-wrap:wrap;");
    footerLegend.forEach((item) => {
      const entry = div(legend, "display:flex;gap:6px;align-items:center;");
      entry.createEl("span", { text: "\u258C", attr: { style: `color:${item.color};font-size:12px;line-height:1;` } });
      entry.createEl("span", { text: item.label, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    });
  }
}
function renderDualLineChart(parent, primary, secondary, footerLeft, primaryLabel, secondaryLabel, chartW = 900) {
  const paired = primary.map((p, i) => {
    var _a, _b;
    return { date: p.date, p: p.value, s: (_b = (_a = secondary[i]) == null ? void 0 : _a.value) != null ? _b : null };
  }).filter((row) => row.p !== null || row.s !== null);
  if (paired.length < 2) {
    parent.createEl("div", { text: "Not enough data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const vals = paired.flatMap((row) => [row.p, row.s]).filter((v) => v !== null && Number.isFinite(v));
  if (vals.length < 2) {
    parent.createEl("div", { text: "Not enough data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }
  const panel = chartPanel(parent);
  const W = chartW, H = Math.round(chartW * 0.26), P = { t: 10, r: 10, b: 28, l: 10 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1;
  const sx = (i) => P.l + i / Math.max(paired.length - 1, 1) * W2;
  const sy = (v) => P.t + H2 - (v - minV) / range * H2;
  const s = svg(panel, W, H);
  const tt = makeTooltip(panel);
  const cross = sLine(s, P.l, P.t, P.l, P.t + H2, "rgba(148,163,184,0.35)");
  cross.style.display = "none";
  const dot1 = sCircle(s, P.l, P.t, 3.5, "#4f8dfd", 1);
  const dot2 = sCircle(s, P.l, P.t, 3.5, "#d4a514", 1);
  dot1.style.display = "none";
  dot2.style.display = "none";
  [0.2, 0.5, 0.8].forEach((frac) => {
    const y = P.t + frac * H2;
    sLine(s, P.l, y, W - P.r, y, "rgba(148,163,184,0.08)");
  });
  const buildPath = (key) => {
    let path = "";
    paired.forEach((row, i) => {
      const value = row[key];
      if (value === null)
        return;
      const cmd = path ? "L" : "M";
      path += ` ${cmd} ${sx(i)} ${sy(value)}`;
    });
    return path.trim();
  };
  const primaryPath = buildPath("p");
  const secondaryPath = buildPath("s");
  if (primaryPath)
    sPath(s, primaryPath, "#4f8dfd", "none", 2.2);
  if (secondaryPath)
    sPath(s, secondaryPath, "#d4a514", "none", 1.8);
  paired.forEach((row, i) => {
    const left = i === 0 ? P.l : (sx(i - 1) + sx(i)) / 2;
    const right = i === paired.length - 1 ? W - P.r : (sx(i) + sx(i + 1)) / 2;
    const hit = sRect(s, left, P.t, Math.max(6, right - left), H2, "transparent", 0);
    hit.style.cursor = "crosshair";
    const showPointTooltip = (e) => {
      const x = sx(i);
      cross.setAttribute("x1", String(x));
      cross.setAttribute("x2", String(x));
      cross.style.display = "block";
      if (row.p !== null) {
        dot1.setAttribute("cx", String(x));
        dot1.setAttribute("cy", String(sy(row.p)));
        dot1.style.display = "block";
      } else
        dot1.style.display = "none";
      if (row.s !== null) {
        dot2.setAttribute("cx", String(x));
        dot2.setAttribute("cy", String(sy(row.s)));
        dot2.style.display = "block";
      } else
        dot2.style.display = "none";
      showTooltip(tt, e, (el) => {
        el.createEl("div", { text: row.date, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
        if (row.p !== null)
          el.createEl("div", { text: `${primaryLabel}: ${fmt(row.p, 0)}`, attr: { style: `color:#4f8dfd;` } });
        if (row.s !== null)
          el.createEl("div", { text: `${secondaryLabel}: ${fmt(row.s, 0)}`, attr: { style: `color:#d4a514;` } });
      });
    };
    hit.addEventListener("mouseenter", showPointTooltip);
    hit.addEventListener("mousemove", (e) => {
      showPointTooltip(e);
      moveTooltip(tt, e);
    });
    hit.addEventListener("mouseleave", () => {
      cross.style.display = "none";
      dot1.style.display = "none";
      dot2.style.display = "none";
      hideTooltip(tt);
    });
  });
  drawXAxisTicks(s, paired.map((row) => row.date), sx, H - 6);
  const footer = div(panel, "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;flex-wrap:wrap;");
  footer.createEl("div", { text: footerLeft, attr: { style: `color:${C.text};font-size:11px;font-family:${F};font-weight:700;` } });
  const legend = div(footer, "display:flex;gap:12px;align-items:center;flex-wrap:wrap;");
  [[primaryLabel, "#4f8dfd"], [secondaryLabel, "#d4a514"]].forEach(([label, color]) => {
    const entry = div(legend, "display:flex;gap:6px;align-items:center;");
    entry.createEl("span", { text: "\u2014", attr: { style: `color:${color};font-size:14px;line-height:1;font-weight:700;` } });
    entry.createEl("span", { text: label, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
  });
}
function renderMarketMonitorTable(parent, rows, visibleRows, onLoadMore, dateFrom, dateTo, onDateChange) {
  const controls = div(parent, "display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;");
  const left = div(controls, "display:flex;gap:8px;align-items:end;flex-wrap:wrap;");
  [["From", dateFrom, "from"], ["To", dateTo, "to"]].forEach(([label, value, field]) => {
    const wrap2 = div(left, "display:flex;flex-direction:column;gap:4px;");
    wrap2.createEl("label", { text: String(label), attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    const input = wrap2.createEl("input", { type: "date", value: String(value), attr: { style: `background:${C.card};border:1px solid ${C.border};color:${C.text};padding:6px 8px;border-radius:6px;font-family:${F};font-size:11px;` } });
    input.addEventListener("change", () => onDateChange(field, input.value));
  });
  const clearBtn = left.createEl("button", { text: "Clear", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};height:32px;` } });
  clearBtn.addEventListener("click", () => {
    onDateChange("from", "");
    onDateChange("to", "");
  });
  controls.createEl("div", { text: `Showing ${Math.min(rows.length, visibleRows)} / ${rows.length} rows`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });
  const wrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = wrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:1400px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};position:sticky;top:0;` } });
  ["Date", "4%+ Up", "4%+ Down", "5d Ratio", "10d Ratio", "25%+ Q Up", "25%+ Q Down", "25%+ M Up", "25%+ M Down", "50%+ M Up", "50%+ M Down", "13%+ 34d Up", "13%+ 34d Down", "T2108"].forEach((h) => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });
  latestRows(rows, visibleRows).forEach((row) => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);` } });
    const pair1 = rowPairStyles(row.up4, row.down4);
    const pair2 = rowPairStyles(row.upQuarter25, row.downQuarter25);
    const pair3 = rowPairStyles(row.upMonth25, row.downMonth25);
    const pair4 = rowPairStyles(row.upMonth50, row.downMonth50);
    const pair5 = rowPairStyles(row.up34, row.down34);
    const cells = [
      { text: row.dateDisplay, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: String(row.up4), style: `padding:8px;text-align:right;${pair1[0]}` },
      { text: String(row.down4), style: `padding:8px;text-align:right;${pair1[1]}` },
      { text: row.ratio5 === null ? "-" : fmt(row.ratio5), style: `padding:8px;text-align:right;font-weight:700;background:${row.ratio5 !== null && row.ratio5 >= 1 ? "rgba(74,222,128,0.12)" : "transparent"};color:${row.ratio5 !== null && row.ratio5 >= 1 ? C.green : C.text};` },
      { text: row.ratio10 === null ? "-" : fmt(row.ratio10), style: `padding:8px;text-align:right;font-weight:700;background:${row.ratio10 !== null && row.ratio10 >= 1 ? "rgba(74,222,128,0.12)" : "transparent"};color:${row.ratio10 !== null && row.ratio10 >= 1 ? C.green : C.text};` },
      { text: String(row.upQuarter25), style: `padding:8px;text-align:right;${pair2[0]}` },
      { text: String(row.downQuarter25), style: `padding:8px;text-align:right;${pair2[1]}` },
      { text: String(row.upMonth25), style: `padding:8px;text-align:right;${pair3[0]}` },
      { text: String(row.downMonth25), style: `padding:8px;text-align:right;${pair3[1]}` },
      { text: String(row.upMonth50), style: `padding:8px;text-align:right;${pair4[0]}` },
      { text: String(row.downMonth50), style: `padding:8px;text-align:right;${pair4[1]}` },
      { text: String(row.up34), style: `padding:8px;text-align:right;${pair5[0]}` },
      { text: String(row.down34), style: `padding:8px;text-align:right;${pair5[1]}` },
      { text: row.t2108 === null ? "-" : fmt(row.t2108), style: `padding:8px;text-align:right;font-weight:700;color:${row.t2108 !== null && row.t2108 < 20 ? C.green : C.text};background:${row.t2108 !== null && row.t2108 < 20 ? "rgba(74,222,128,0.12)" : "transparent"};` }
    ];
    cells.forEach((cell) => {
      var _a;
      return tr.createEl("td", { text: cell.text, attr: { style: (_a = cell.style) != null ? _a : "padding:8px;" } });
    });
  });
  if (rows.length > visibleRows) {
    const moreWrap = div(parent, "display:flex;justify-content:center;margin-top:12px;");
    const more = moreWrap.createEl("button", { text: "Show 5 more", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.blue};border-radius:6px;padding:7px 12px;cursor:pointer;font-size:11px;font-family:${F};` } });
    more.addEventListener("click", onLoadMore);
  }
}
function renderMarketMonitorStats(parent, rows) {
  var _a, _b, _c;
  const ratios5 = rows.map((r) => r.ratio5).filter((v) => v !== null);
  const ratios10 = rows.map((r) => r.ratio10).filter((v) => v !== null);
  const t2108 = rows.map((r) => r.t2108).filter((v) => v !== null);
  const grid = div(parent, "display:grid;grid-template-columns:repeat(6,minmax(140px,1fr));gap:10px;margin-bottom:12px;");
  metricCell(grid, "Avg 5 Day Ratio", ratios5.length ? fmt((_a = MarketMonitorMath.average(ratios5)) != null ? _a : 0) : "-");
  metricCell(grid, "Avg 10 Day Ratio", ratios10.length ? fmt((_b = MarketMonitorMath.average(ratios10)) != null ? _b : 0) : "-");
  metricCell(grid, "Max 4% Up", rows.length ? String(Math.max(...rows.map((r) => r.up4))) : "-");
  metricCell(grid, "Max 4% Down", rows.length ? String(Math.max(...rows.map((r) => r.down4))) : "-");
  metricCell(grid, "T2108 Max / Min", t2108.length ? `${fmt(Math.max(...t2108), 0)} / ${fmt(Math.min(...t2108), 0)}` : "-");
  metricCell(grid, "T2108 Avg", t2108.length ? fmt((_c = MarketMonitorMath.average(t2108)) != null ? _c : 0) : "-");
}
function renderPerformanceTrackStats(parent, rows) {
  const metrics = [
    { label: "8%+ Up 5d", values: rows.map((r) => r.up8_5d) },
    { label: "8%+ Down 5d", values: rows.map((r) => r.down8_5d) },
    { label: "20%+ Up 5d", values: rows.map((r) => r.up20_5d) },
    { label: "20%+ Down 5d", values: rows.map((r) => r.down20_5d) },
    { label: "%Above 21SMA", values: rows.map((r) => r.above21sma) },
    { label: "%Above 200SMA", values: rows.map((r) => r.above200sma) }
  ];
  const grid = div(parent, "display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;");
  metrics.forEach((metric) => {
    var _a;
    const vals = metric.values;
    const avg = vals.length ? (_a = MarketMonitorMath.average(vals)) != null ? _a : 0 : null;
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    const c = card(grid, "padding:12px;");
    c.createEl("div", { text: metric.label, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-family:${F};` } });
    c.createEl("div", { text: avg === null ? "-" : `Avg ${fmt(avg, 1)}`, attr: { style: `color:${C.text};font-size:16px;font-weight:700;font-family:${F};margin-bottom:4px;` } });
    c.createEl("div", { text: min === null || max === null ? "-" : `Min ${fmt(min, 1)} \xB7 Max ${fmt(max, 1)}`, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
  });
}
function renderPerformanceTracksTable(parent, rows, visibleRows, onLoadMore, dateFrom, dateTo, onDateChange) {
  var _a, _b;
  const avg21 = rows.length ? (_a = MarketMonitorMath.average(rows.map((r) => r.above21sma))) != null ? _a : 0 : 0;
  const avg200 = rows.length ? (_b = MarketMonitorMath.average(rows.map((r) => r.above200sma))) != null ? _b : 0 : 0;
  const controls = div(parent, "display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;");
  const left = div(controls, "display:flex;gap:8px;align-items:end;flex-wrap:wrap;");
  [["From", dateFrom, "from"], ["To", dateTo, "to"]].forEach(([label, value, field]) => {
    const wrap2 = div(left, "display:flex;flex-direction:column;gap:4px;");
    wrap2.createEl("label", { text: String(label), attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    const input = wrap2.createEl("input", { type: "date", value: String(value), attr: { style: `background:${C.card};border:1px solid ${C.border};color:${C.text};padding:6px 8px;border-radius:6px;font-family:${F};font-size:11px;` } });
    input.addEventListener("change", () => onDateChange(field, input.value));
  });
  const clearBtn = left.createEl("button", { text: "Clear", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};height:32px;` } });
  clearBtn.addEventListener("click", () => {
    onDateChange("from", "");
    onDateChange("to", "");
  });
  controls.createEl("div", { text: `Showing ${Math.min(rows.length, visibleRows)} / ${rows.length} rows`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });
  const wrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = wrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:920px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};position:sticky;top:0;` } });
  ["Date", "8%+ Up 5d", "8%+ Down 5d", "20%+ Up 5d", "20%+ Down 5d", "%Above 21SMA", "%Above 200SMA"].forEach((h) => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });
  latestRows(rows, visibleRows).forEach((row) => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);` } });
    const pair8 = rowPairStyles(row.up8_5d, row.down8_5d);
    const pair20 = rowPairStyles(row.up20_5d, row.down20_5d);
    const cells = [
      { text: row.dateDisplay, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: fmt(row.up8_5d, 0), style: `padding:8px;text-align:right;${pair8[0]}` },
      { text: fmt(row.down8_5d, 0), style: `padding:8px;text-align:right;${pair8[1]}` },
      { text: fmt(row.up20_5d, 0), style: `padding:8px;text-align:right;${pair20[0]}` },
      { text: fmt(row.down20_5d, 0), style: `padding:8px;text-align:right;${pair20[1]}` },
      { text: fmt(row.above21sma, 1), style: `padding:8px;text-align:right;font-weight:700;color:${row.above21sma >= avg21 ? C.green : C.red};` },
      { text: fmt(row.above200sma, 1), style: `padding:8px;text-align:right;font-weight:700;color:${row.above200sma >= avg200 ? C.green : C.red};` }
    ];
    cells.forEach((cell) => tr.createEl("td", { text: cell.text, attr: { style: cell.style } }));
  });
  if (rows.length > visibleRows) {
    const moreWrap = div(parent, "display:flex;justify-content:center;margin-top:12px;");
    const more = moreWrap.createEl("button", { text: "Show 5 more", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.blue};border-radius:6px;padding:7px 12px;cursor:pointer;font-size:11px;font-family:${F};` } });
    more.addEventListener("click", onLoadMore);
  }
}
function renderMarketCharts(parent, highLowRows, adRows, chartFrom, chartTo, onChartRange) {
  var _a, _b, _c, _d, _e;
  const controls = div(parent, "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px;");
  const btnWrap = div(controls, "display:flex;gap:8px;flex-wrap:wrap;");
  [
    ["1M", 30],
    ["3M", 90],
    ["6M", 180],
    ["1Y", 365]
  ].forEach(([label, days]) => {
    const active = chartFrom === lastNDaysIso(days) && chartTo === "";
    const btn = btnWrap.createEl("button", { text: String(label), attr: { style: `${active ? `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};` : `background:transparent;color:${C.muted};border:1px solid ${C.border};`}border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};` } });
    btn.addEventListener("click", () => onChartRange(lastNDaysIso(days), ""));
  });
  const allBtn = btnWrap.createEl("button", { text: "All", attr: { style: `${!chartFrom && !chartTo ? `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};` : `background:transparent;color:${C.muted};border:1px solid ${C.border};`}border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};` } });
  allBtn.addEventListener("click", () => onChartRange("", ""));
  controls.createEl("div", { text: "Chart range", attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });
  const highLowSeries = MarketMonitorMath.sortAscByDate(filterByDateRange(highLowRows, chartFrom || void 0, chartTo || void 0));
  const adSeries = MarketMonitorMath.sortAscByDate(filterByDateRange(adRows, chartFrom || void 0, chartTo || void 0));
  const summationValues = adSeries.map((r) => r.summation);
  const summationSma10 = seriesSma(summationValues, 10);
  const latestMc = (_b = (_a = [...adSeries].reverse().find((r) => r.mcclellan !== null)) == null ? void 0 : _a.mcclellan) != null ? _b : null;
  const latestSum = (_d = (_c = [...adSeries].reverse().find((r) => r.summation !== null)) == null ? void 0 : _c.summation) != null ? _d : null;
  const latestSma = (_e = [...summationSma10].reverse().find((v) => v !== null)) != null ? _e : null;
  const latestHl = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].net : null;
  const latestHigh = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].high52 : 0;
  const latestLow = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].low52 : 0;
  const stack = div(parent, "display:grid;grid-template-columns:1fr;gap:12px;");
  const mcoData = adSeries.filter((r) => r.mcclellan !== null).map((r) => {
    var _a2;
    return { date: r.dateIso, value: (_a2 = r.mcclellan) != null ? _a2 : 0 };
  });
  const sumPrimary = adSeries.map((r) => ({ date: r.dateIso, value: r.summation }));
  const sumSecondary = adSeries.map((r, i) => ({ date: r.dateIso, value: summationSma10[i] }));
  const hlData = highLowSeries.map((r) => ({ date: r.dateIso, value: r.net }));
  const mc = card(stack);
  cardTitle(mc, "McClellan Oscillator");
  if (adSeries.length < 39) {
    mc.createEl("div", { text: `Need at least 39 Advance/Decline rows to calculate McClellan Oscillator (${adSeries.length} loaded).`, attr: { style: `color:${C.muted};font-size:11px;` } });
  } else {
    addExpandLink(mc, "McClellan Oscillator", (c) => renderOscillatorHistogram(c, mcoData, latestMc === null ? "" : `MCO ${fmt(latestMc, 0)}`, [], 1100));
    renderOscillatorHistogram(
      mc,
      mcoData,
      latestMc === null ? "" : `MCO ${fmt(latestMc, 0)}`,
      [],
      900
    );
  }
  const si = card(stack);
  cardTitle(si, "Summation Index + 10 SMA");
  if (adSeries.length < 39) {
    si.createEl("div", { text: `Need at least 39 Advance/Decline rows to calculate Summation Index (${adSeries.length} loaded).`, attr: { style: `color:${C.muted};font-size:11px;` } });
  } else {
    addExpandLink(si, "Summation Index + 10 SMA", (c) => renderDualLineChart(c, sumPrimary, sumSecondary, latestSum === null ? "" : `MCSI ${fmt(latestSum, 0)}`, latestSum === null ? "MCSI" : `MCSI ${fmt(latestSum, 0)}`, latestSma === null ? "10 SMA" : `10 SMA ${fmt(latestSma, 0)}`, 1100));
    renderDualLineChart(
      si,
      sumPrimary,
      sumSecondary,
      latestSum === null ? "" : `MCSI ${fmt(latestSum, 0)}`,
      latestSum === null ? "MCSI" : `MCSI ${fmt(latestSum, 0)}`,
      latestSma === null ? "10 SMA" : `10 SMA ${fmt(latestSma, 0)}`,
      900
    );
  }
  const hl = card(stack);
  addExpandLink(hl, "52-Week H/L Oscillator", (c) => renderOscillatorHistogram(c, hlData, latestHl === null ? "" : `${fmt(latestHl, 0)} (${fmt(latestHigh, 0)}H / ${fmt(latestLow, 0)}L)`, [
    { label: "Net Highs", color: "#35d2a0" },
    { label: "Net Lows", color: "#ff7d72" }
  ], 1100));
  cardTitle(hl, "52-Week H/L Oscillator");
  renderOscillatorHistogram(
    hl,
    hlData,
    latestHl === null ? "" : `${fmt(latestHl, 0)} (${fmt(latestHigh, 0)}H / ${fmt(latestLow, 0)}L)`,
    [
      { label: "Net Highs", color: "#35d2a0" },
      { label: "Net Lows", color: "#ff7d72" }
    ],
    900
  );
}
function renderMarketMonitorView(container, marketData, visibleRows, onLoadMore, tableFrom, tableTo, onTableDateChange, performanceVisibleRows, onPerformanceLoadMore, performanceDateFrom, performanceDateTo, onPerformanceDateChange, chartFrom, chartTo, onChartRange) {
  if (!marketData) {
    const empty = card(container, "margin:12px 16px 16px;");
    cardTitle(empty, "Market Monitor");
    empty.createEl("div", { text: "Market Data.md could not be loaded or parsed.", attr: { style: `color:${C.muted};font-size:12px;` } });
    return;
  }
  const filteredRows = filterByDateRange(marketData.monitorRows, tableFrom || void 0, tableTo || void 0);
  const statsCard = card(container, "margin:12px 16px 0;");
  cardTitle(statsCard, "Market Monitor Stats");
  renderMarketMonitorStats(statsCard, filteredRows);
  const tableCard = card(container, "margin:12px 16px 0;");
  cardTitle(tableCard, "Market Monitor Table");
  renderMarketMonitorTable(tableCard, filteredRows, visibleRows, onLoadMore, tableFrom, tableTo, onTableDateChange);
  const performanceRows = filterByDateRange(marketData.performanceTrackRows, performanceDateFrom || void 0, performanceDateTo || void 0);
  const perfStats = card(container, "margin:12px 16px 0;");
  cardTitle(perfStats, "Performance Tracks Stats");
  renderPerformanceTrackStats(perfStats, performanceRows);
  const perfTable = card(container, "margin:12px 16px 0;");
  cardTitle(perfTable, "Performance Tracks");
  renderPerformanceTracksTable(perfTable, performanceRows, performanceVisibleRows, onPerformanceLoadMore, performanceDateFrom, performanceDateTo, onPerformanceDateChange);
  const chartCard = card(container, "margin:12px 16px 16px;");
  cardTitle(chartCard, "Breadth Charts");
  renderMarketCharts(chartCard, marketData.highLowRows, marketData.advanceDeclineRows, chartFrom, chartTo, onChartRange);
}
function renderDashboard(container, stats, trades, openRows, openAnalytics, events, filters, onFilterChange, openFile, marketData, state) {
  container.style.cssText = `background:${C.bg};height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:${F};color:${C.text};`;
  let tradeListData = trades;
  const redraw = () => {
    container.empty();
    container.style.cssText = `background:${C.bg};height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:${F};color:${C.text};`;
    const hdr = div(container, `display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid ${C.border};background:${C.card};flex-shrink:0;position:sticky;top:0;z-index:50;`);
    hdr.createEl("div", { text: "Trading Dashboard", attr: { style: `color:${C.text};font-size:18px;font-weight:700;font-family:${F};` } });
    const hRight = div(hdr, "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
    hRight.createEl("div", { text: `${trades.length} total trades`, attr: { style: `color:${C.muted};font-size:11px;` } });
    const actTab = `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const inTab = `background:transparent;color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const dashBtn = hRight.createEl("button", { text: "Dashboard", attr: { style: state.activeTab === "dashboard" ? actTab : inTab } });
    const tradesBtn = hRight.createEl("button", { text: "Trades", attr: { style: state.activeTab === "trades" ? actTab : inTab } });
    const marketBtn = hRight.createEl("button", { text: "Market Monitor", attr: { style: state.activeTab === "market" ? actTab : inTab } });
    dashBtn.addEventListener("click", () => {
      state.activeTab = "dashboard";
      redraw();
    });
    tradesBtn.addEventListener("click", () => {
      state.activeTab = "trades";
      tradeListData = trades;
      redraw();
    });
    marketBtn.addEventListener("click", () => {
      state.activeTab = "market";
      redraw();
    });
    const onShowTrades = (t) => {
      state.activeTab = "trades";
      tradeListData = t;
      redraw();
    };
    if (state.activeTab !== "market")
      renderFilters(container, trades, filters, (f) => {
        onFilterChange(f);
      });
    const content = div(container, "flex:1;min-height:0;overflow-y:auto;");
    if (state.activeTab === "trades") {
      renderTradesList(div(content, "padding:16px;height:100%;box-sizing:border-box;"), tradeListData, openFile);
      return;
    }
    if (state.activeTab === "market") {
      renderMarketMonitorView(
        content,
        marketData,
        state.marketVisibleRows,
        () => {
          state.marketVisibleRows += 5;
          redraw();
        },
        state.marketDateFrom,
        state.marketDateTo,
        (field, value) => {
          if (field === "from")
            state.marketDateFrom = value;
          else
            state.marketDateTo = value;
          state.marketVisibleRows = 20;
          redraw();
        },
        state.performanceVisibleRows,
        () => {
          state.performanceVisibleRows += 5;
          redraw();
        },
        state.performanceDateFrom,
        state.performanceDateTo,
        (field, value) => {
          if (field === "from")
            state.performanceDateFrom = value;
          else
            state.performanceDateTo = value;
          state.performanceVisibleRows = 15;
          redraw();
        },
        state.chartDateFrom,
        state.chartDateTo,
        (from, to) => {
          state.chartDateFrom = from;
          state.chartDateTo = to;
          redraw();
        }
      );
      return;
    }
    renderStatsBar(content, stats, trades, openAnalytics, onShowTrades, openFile);
    const filteredOpenRows = filterOpenRows(openRows, filters);
    const op = card(content, "margin:0 16px 0;");
    cardTitle(op, "Open Positions vs Cash");
    renderOpenPositionsPie(op, filteredOpenRows, stats.current_balance, openFile);
    const od = card(content, "margin:12px 16px 0;");
    cardTitle(od, "Open Position Details");
    renderOpenPositionDetails(od, openAnalytics, openFile);
    const g1 = div(content, "display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const eq = card(g1);
    addExpandBtn(eq, "Equity Curve", (c) => renderEquity(c, stats.equity_curve, 900));
    cardTitle(eq, "Equity Curve");
    renderEquity(eq, stats.equity_curve);
    const dd = card(g1);
    addExpandBtn(dd, "Drawdown", (c) => renderDrawdown(c, stats.drawdown_curve, 900));
    cardTitle(dd, "Drawdown");
    renderDrawdown(dd, stats.drawdown_curve);
    const g2 = div(content, "display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const mb = card(g2);
    cardTitle(mb, "Monthly P&L");
    renderMonthlyBars(mb, stats.monthly_pnl, trades, onShowTrades);
    const sk = card(g2);
    cardTitle(sk, "Win/Loss Streak");
    renderStreak(sk, stats.streak, trades, onShowTrades);
    const lw = card(content, "margin:12px 16px 0;");
    cardTitle(lw, "Largest Win & Loss");
    renderLargest(lw, stats, openFile);
    const cal = card(content, "margin:12px 16px 0;overflow-x:auto;");
    cardTitle(cal, "P&L Calendar");
    renderCalendar(cal, stats.daily_pnl, stats.weekly_pnl, trades, openFile, onShowTrades);
    const g3 = div(content, "display:grid;grid-template-columns:3fr 2fr;gap:12px;padding:12px 16px 0;");
    const ts = card(g3);
    cardTitle(ts, "Entry Time Performance (13:00\u201322:00, 30min)");
    renderTimeSlots(ts, stats.pnl_by_slot);
    const dr = card(g3);
    cardTitle(dr, "Trade Duration");
    renderDuration(dr, stats.duration_by_outcome);
    const st = card(content, "margin:12px 16px 0;");
    cardTitle(st, "Strategy Breakdown");
    renderStrategyTable(st, stats, trades, onShowTrades);
    const gr = card(content, "margin:12px 16px 0;");
    cardTitle(gr, "Grade Breakdown");
    renderGrades(gr, stats, trades, onShowTrades);
    const mc = card(content, "margin:12px 16px 16px;");
    addExpandBtn(mc, "Market Conditions vs P&L", (c) => renderCorrelation(c, stats.market_correlation, 900));
    cardTitle(mc, "Market Conditions vs P&L");
    renderCorrelation(mc, stats.market_correlation);
  };
  redraw();
}

// src/main.ts
var DASHBOARD_VIEW = "trading-journal-dashboard";
var SIDEBAR_VIEW = "trading-journal-sidebar";
var DashboardView = class extends import_obsidian4.ItemView {
  constructor(leaf, cache, marketMonitor) {
    super(leaf);
    this.filters = {};
    this.dashboardState = {
      activeTab: "dashboard",
      marketVisibleRows: 20,
      marketDateFrom: "",
      marketDateTo: "",
      performanceVisibleRows: 15,
      performanceDateFrom: "",
      performanceDateTo: "",
      chartDateFrom: (() => {
        const dt = new Date();
        dt.setDate(dt.getDate() - 30);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      })(),
      chartDateTo: ""
    };
    this.unsubscribe = null;
    this.renderSeq = 0;
    this.cache = cache;
    this.marketMonitor = marketMonitor;
  }
  getViewType() {
    return DASHBOARD_VIEW;
  }
  getDisplayText() {
    return "Trading Dashboard";
  }
  getIcon() {
    return "bar-chart-2";
  }
  onOpen() {
    return __async(this, null, function* () {
      this.render();
      if (!this.unsubscribe) {
        const listener = () => this.render();
        this.cache.onUpdate(listener);
        this.unsubscribe = () => this.cache.offUpdate(listener);
      }
    });
  }
  onClose() {
    return __async(this, null, function* () {
      var _a;
      (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
      this.unsubscribe = null;
    });
  }
  render() {
    return __async(this, null, function* () {
      const seq = ++this.renderSeq;
      const container = this.containerEl.children[1];
      container.empty();
      container.style.cssText = "padding:0;overflow:hidden;height:100%;";
      const allTrades = this.cache.getTrades();
      const openRows = this.cache.getOpenRows();
      const events = this.cache.getAccountEvents();
      const filtered = filterTrades(allTrades, this.filters);
      const stats = calcStats(allTrades, events, this.filters);
      const [marketData, openAnalytics] = yield Promise.all([
        this.marketMonitor.getDashboardData(),
        this.marketMonitor.getOpenPositionAnalytics(allTrades, openRows, stats.current_balance, this.filters)
      ]);
      if (seq !== this.renderSeq)
        return;
      renderDashboard(
        container,
        stats,
        filtered,
        openRows,
        openAnalytics,
        events,
        this.filters,
        (f) => {
          this.filters = f;
          void this.render();
        },
        (filePath) => this.openFile(filePath),
        marketData,
        this.dashboardState
      );
    });
  }
  openFile(filePath) {
    return __async(this, null, function* () {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file)
        return;
      const leaf = this.app.workspace.getLeaf(false);
      yield leaf.openFile(file);
    });
  }
};
var SidebarView = class extends import_obsidian4.ItemView {
  constructor(leaf, cache) {
    super(leaf);
    this.unsubscribe = null;
    this.cache = cache;
  }
  openFile(filePath) {
    return __async(this, null, function* () {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file)
        return;
      const leaf = this.app.workspace.getLeaf(false);
      yield leaf.openFile(file);
    });
  }
  getViewType() {
    return SIDEBAR_VIEW;
  }
  getDisplayText() {
    return "Trading Summary";
  }
  getIcon() {
    return "trending-up";
  }
  onOpen() {
    return __async(this, null, function* () {
      this.render();
      if (!this.unsubscribe) {
        const listener = () => this.render();
        this.cache.onUpdate(listener);
        this.unsubscribe = () => this.cache.offUpdate(listener);
      }
    });
  }
  onClose() {
    return __async(this, null, function* () {
      var _a;
      (_a = this.unsubscribe) == null ? void 0 : _a.call(this);
      this.unsubscribe = null;
    });
  }
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.style.cssText = "padding:12px;min-height:100%;";
    const trades = this.cache.getTrades();
    const events = this.cache.getAccountEvents();
    const stats = calcStats(trades, events, {});
    const f = "var(--font-interface),var(--font-text),monospace";
    const streak = stats.streak;
    const wrap = container.createEl("div", { attr: { style: `font-family:${f};` } });
    wrap.createEl("div", { text: "Trading Summary", attr: { style: "color:var(--text-normal);font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:8px;" } });
    const uniqueDirs = /* @__PURE__ */ new Map();
    trades.forEach((t) => {
      const baseId = t.trade_id.replace(/#\d+$/, "");
      if (!uniqueDirs.has(baseId))
        uniqueDirs.set(baseId, t.dir);
    });
    const totalUnique = uniqueDirs.size || 1;
    const longPct = ([...uniqueDirs.values()].filter((v) => v === "long").length / totalUnique * 100).toFixed(1);
    const shortPct = ([...uniqueDirs.values()].filter((v) => v === "short").length / totalUnique * 100).toFixed(1);
    const items = [
      { label: "Net P&L", value: `$${stats.net_pnl.toFixed(2)}`, color: stats.net_pnl >= 0 ? "#4ade80" : "#f87171" },
      { label: "Win Rate", value: `${stats.win_rate}%`, color: stats.win_rate >= 50 ? "#4ade80" : "#f87171" },
      { label: "Profit Factor", value: String(stats.profit_factor), color: stats.profit_factor >= 1 ? "#4ade80" : "#f87171" },
      { label: "Trades", value: `${stats.trade_count} (${stats.win_count}W/${stats.loss_count}L)`, color: "var(--text-muted)" },
      { label: "Largest Win", value: `$${stats.largest_win.toFixed(2)}`, color: "#4ade80" },
      { label: "Largest Loss", value: `-$${stats.largest_loss.toFixed(2)}`, color: "#f87171" },
      { label: "Avg Win", value: `$${stats.avg_win.toFixed(2)}`, color: "#4ade80" },
      { label: "Avg Loss", value: `$${stats.avg_loss.toFixed(2)}`, color: "#f87171" },
      { label: "Avg R", value: `${stats.avg_r_multiple}R`, color: stats.avg_r_multiple >= 0 ? "#4ade80" : "#f87171" },
      { label: "Avg R Win", value: `${stats.avg_r_win}R`, color: "#4ade80" },
      { label: "Avg R Loss", value: `${stats.avg_r_loss}R`, color: "#f87171" },
      { label: "Gain to Pain", value: stats.gain_to_pain === Infinity ? "\u221E" : String(stats.gain_to_pain), color: stats.gain_to_pain >= 1 ? "#4ade80" : "#f87171" },
      { label: "Max DD", value: `${stats.max_drawdown_pct.toFixed(1)}%`, color: "#f87171" },
      { label: "ROI", value: `${stats.overall_roi}%`, color: stats.overall_roi >= 0 ? "#4ade80" : "#f87171" },
      { label: "Balance", value: `$${stats.current_balance.toFixed(2)}`, color: "#60a5fa" },
      { label: "Long %", value: `${longPct}%`, color: Number(longPct) >= 50 ? "#4ade80" : "var(--text-muted)" },
      { label: "Short %", value: `${shortPct}%`, color: Number(shortPct) >= 50 ? "#f87171" : "var(--text-muted)" }
    ];
    items.forEach((item) => {
      const row = wrap.createEl("div", { attr: { style: "display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--background-modifier-border);" } });
      row.createEl("span", { text: item.label, attr: { style: "color:var(--text-muted);font-size:11px;" } });
      row.createEl("span", { text: item.value, attr: { style: `color:${item.color};font-size:12px;font-weight:700;` } });
    });
    if (streak.last5.length) {
      wrap.createEl("div", { text: "Last 5 Trades", attr: { style: "color:var(--text-muted);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:12px;margin-bottom:6px;" } });
      const streakRow = wrap.createEl("div", { attr: { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap;" } });
      streak.last5.forEach(({ trade: t, is_winner: w }) => {
        const dot = streakRow.createEl("div", {
          attr: { style: `width:22px;height:22px;border-radius:50%;background:${w ? "#4ade80" : "#f87171"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;cursor:pointer;flex-shrink:0;` },
          text: w ? "W" : "L"
        });
        dot.setAttribute("title", `${t.exit_date} ${t.exit_time} \xB7 ${t.symbol} ${t.dir.toUpperCase()} \xB7 ${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)} \xB7 ${t.r_multiple}R`);
        dot.addEventListener("click", () => {
          void this.openFile(t.exit_file);
        });
      });
      const mLabel = streak.momentum === "hot" ? "\u{1F525} Hot" : streak.momentum === "cold" ? "\u2744\uFE0F Cold" : "\u3030\uFE0F Mixed";
      streakRow.createEl("span", { text: mLabel, attr: { style: `color:${streak.momentum === "hot" ? "#facc15" : streak.momentum === "cold" ? "#60a5fa" : "var(--text-muted)"};font-size:11px;margin-left:4px;font-weight:700;` } });
    }
    const open = this.cache.getOpenRows();
    if (open.length) {
      wrap.createEl("div", { text: `Open Positions (${open.length})`, attr: { style: "color:#facc15;font-size:11px;font-weight:700;margin-top:12px;margin-bottom:6px;" } });
      open.forEach((r) => {
        var _a;
        const baseId = r.trade_id;
        const relatedExit = trades.find((t) => t.trade_id.replace(/#[0-9]+$/, "") === baseId);
        const initialSize = relatedExit ? relatedExit.entry_size : r.size;
        const currentSize = parseFloat(r.size.toFixed(4));
        const pct = initialSize > 0 ? (currentSize / initialSize * 100).toFixed(0) : "\u2014";
        const posWrap = wrap.createEl("div", { attr: { style: "padding:6px 0;border-bottom:1px solid var(--background-modifier-border);cursor:pointer;" } });
        posWrap.addEventListener("click", () => {
          if (r.filePath)
            void this.openFile(r.filePath);
        });
        const row1 = posWrap.createEl("div", { attr: { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;" } });
        row1.createEl("span", { text: `${r.symbol} ${((_a = r.dir) != null ? _a : "").toUpperCase()}`, attr: { style: "color:var(--text-normal);font-size:12px;font-weight:700;" } });
        row1.createEl("span", { text: `@$${r.price}`, attr: { style: "color:var(--text-muted);font-size:11px;" } });
        const row2 = posWrap.createEl("div", { attr: { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;" } });
        row2.createEl("span", { text: `${currentSize} / ${initialSize} shares`, attr: { style: "color:var(--text-muted);font-size:10px;" } });
        row2.createEl("span", {
          text: `${pct}% open`,
          attr: { style: `color:${Number(pct) > 50 ? "#facc15" : "#fb923c"};font-size:10px;font-weight:700;` }
        });
        if (r.target_sl) {
          const slPct = r.price > 0 ? (r.dir === "short" ? r.price - r.target_sl : r.target_sl - r.price) / r.price * 100 : 0;
          const row3 = posWrap.createEl("div", { attr: { style: "display:flex;justify-content:space-between;" } });
          row3.createEl("span", { text: "Target SL", attr: { style: "color:var(--text-faint);font-size:10px;" } });
          row3.createEl("span", { text: `$${r.target_sl} (${slPct >= 0 ? "+" : ""}${slPct.toFixed(1)}%)`, attr: { style: "color:#f87171;font-size:10px;font-weight:700;" } });
        }
      });
    }
    wrap.createEl("div", { text: `\u21BB ${new Date(this.cache.getLastUpdated()).toLocaleTimeString()}`, attr: { style: "color:var(--text-faint);font-size:10px;margin-top:10px;text-align:center;" } });
  }
};
var TradingJournalPlugin = class extends import_obsidian4.Plugin {
  onload() {
    return __async(this, null, function* () {
      this.cache = new CacheManager(this);
      this.marketMonitor = new MarketMonitorService(this);
      yield this.cache.initialize();
      this.registerView(DASHBOARD_VIEW, (leaf) => new DashboardView(leaf, this.cache, this.marketMonitor));
      this.registerView(SIDEBAR_VIEW, (leaf) => new SidebarView(leaf, this.cache));
      this.addRibbonIcon("bar-chart-2", "Trading Dashboard", () => this.openDashboard());
      this.addCommand({ id: "open-trading-dashboard", name: "Open Trading Dashboard", callback: () => this.openDashboard() });
      this.addCommand({ id: "open-trading-sidebar", name: "Open Trading Sidebar", callback: () => this.openSidebar() });
      this.addCommand({
        id: "rebuild-trading-cache",
        name: "Rebuild Trading Cache",
        callback: () => __async(this, null, function* () {
          yield this.cache.rebuild((msg) => console.log("Trading Journal:", msg));
        })
      });
      this.addCommand({
        id: "update-market-monitor-and-frontmatter",
        name: "Update Market Data + Daily Frontmatter",
        callback: () => __async(this, null, function* () {
          var _a;
          const result = yield this.marketMonitor.syncActiveOrTodayNote();
          if (result.updatedFrontmatter) {
            new import_obsidian4.Notice(`Market data synced${result.updatedMarketData ? " and Market Data.md updated" : ""}`);
          } else if (result.updatedMarketData) {
            new import_obsidian4.Notice(`Market Data.md updated${result.skipped ? ` \u2014 ${result.skipped}` : ""}`);
          } else {
            new import_obsidian4.Notice((_a = result.skipped) != null ? _a : "No market monitor updates were applied.");
          }
        })
      });
      this.addCommand({
        id: "debug-trading-data",
        name: "Trading Journal: Debug \u2014 dump data to console",
        callback: () => {
          const trades = this.cache.getTrades();
          const open = this.cache.getOpenRows();
          console.group("=== Trading Journal Debug ===");
          console.log(`Total unique trades: ${new Set(trades.map((t) => t.trade_id.replace(/#\\d+$/, ""))).size} (${trades.length} exit records)`);
          console.log(`Total open rows: ${open.length}`);
          console.log("\n--- All trades (entry_date, exit_date, symbol, pnl, market_score) ---");
          trades.forEach((t) => {
            var _a;
            return console.log(`${t.entry_date} \u2192 ${t.exit_date} | ${t.symbol} | P&L: $${t.pnl} | market_score: ${(_a = t.market_score) != null ? _a : "MISSING"} | exit_count: ${t.exit_count} | filled: ${t.filled_size}/${t.entry_size}`);
          });
          console.log("\n--- Open rows ---");
          open.forEach((r) => console.log(`${r.date} | ${r.symbol} | size: ${r.size} | type: ${r.type}`));
          const byDate = {};
          trades.forEach((t) => {
            if (!byDate[t.exit_date])
              byDate[t.exit_date] = [];
            byDate[t.exit_date].push(t);
          });
          console.log("\n--- Trades grouped by exit_date (what calendar shows) ---");
          Object.entries(byDate).sort().forEach(([d, ts]) => {
            const total = ts.reduce((s, t) => s + t.pnl, 0);
            console.log(`${d}: ${ts.length} trades, total P&L: $${total.toFixed(2)}`);
            ts.forEach((t) => console.log(`  \u2514 ${t.symbol} ${t.dir} | entry: ${t.entry_date} | P&L: $${t.pnl} | exits: ${t.exit_count} | filled: ${t.filled_size}/${t.entry_size}`));
          });
          console.groupEnd();
          const vault = this.app.vault;
          const mc = this.app.metadataCache;
          const files = vault.getFiles().filter((f) => f.path.startsWith("Master/Journal") && f.extension === "md");
          console.group("=== Market Score Frontmatter Debug ===");
          console.log(`Scanning ${files.length} journal files for 'score' frontmatter...`);
          let found = 0, missing = 0;
          files.forEach((f) => {
            var _a, _b;
            const fm = (_a = mc.getFileCache(f)) == null ? void 0 : _a.frontmatter;
            const score = (_b = fm == null ? void 0 : fm["score"]) != null ? _b : fm == null ? void 0 : fm["market_score"];
            if (score !== void 0 && score !== null) {
              console.log(`  FOUND: ${f.basename} \u2192 score = ${JSON.stringify(score)} (type: ${typeof score})`);
              found++;
            } else {
              console.log(`  MISSING: ${f.basename} \u2192 frontmatter keys: ${fm ? Object.keys(fm).join(", ") : "NO FRONTMATTER"}`);
              missing++;
            }
          });
          console.log(`
Summary: ${found} with score, ${missing} without`);
          console.groupEnd();
          new import_obsidian4.Notice("Debug data dumped to console (Ctrl+Shift+I to open DevTools)");
        }
      });
      this.registerEvent(this.app.vault.on("create", (file) => {
        void this.marketMonitor.syncForCreatedFile(file);
      }));
      this.registerEvent(this.app.workspace.on("file-open", (file) => {
        if (file)
          void this.marketMonitor.syncForCreatedFile(file);
      }));
      this.app.workspace.onLayoutReady(() => this.openSidebar());
    });
  }
  onunload() {
    return __async(this, null, function* () {
    });
  }
  openDashboard() {
    return __async(this, null, function* () {
      const existing = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW);
      if (existing.length) {
        this.app.workspace.revealLeaf(existing[0]);
        return;
      }
      const leaf = this.app.workspace.getLeaf(true);
      yield leaf.setViewState({ type: DASHBOARD_VIEW, active: true });
      this.app.workspace.revealLeaf(leaf);
    });
  }
  openSidebar() {
    return __async(this, null, function* () {
      if (this.app.workspace.getLeavesOfType(SIDEBAR_VIEW).length)
        return;
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf)
        yield leaf.setViewState({ type: SIDEBAR_VIEW, active: true });
    });
  }
};
