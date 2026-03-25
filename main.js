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
var import_obsidian3 = require("obsidian");

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
      if (!file.path.startsWith("Master/Journal") && file.path !== "Accounts.md")
        return;
      if (this.debounceTimer !== null)
        window.clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
        this.buildCache(true);
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
    largest_win: 0,
    largest_loss: 0,
    day_win_rate: 0,
    overall_roi: 0,
    max_drawdown: 0,
    max_drawdown_pct: 0,
    current_balance: 0,
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
  const initBal = accountEvents.filter((e) => (!filters.account || e.account === filters.account) && e.type === "initial").reduce((s, e) => s + e.amount, 0) || 1e4;
  const balance = (_b = (_a = equity[equity.length - 1]) == null ? void 0 : _a.value) != null ? _b : initBal;
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
    avg_win_loss_ratio: ftWins.length > 0 && ftLosses.length > 0 ? parseFloat((gw / ftWins.length / (gl / ftLosses.length)).toFixed(2)) : 0,
    largest_win: largestWinPnl > 0 ? largestWinPnl : 0,
    largest_win_trade: largestWinTrade,
    largest_loss: largestLossPnl < 0 ? Math.abs(largestLossPnl) : 0,
    largest_loss_trade: largestLossTrade,
    day_win_rate: daily.length > 0 ? parseFloat((winDays / daily.length * 100).toFixed(1)) : 0,
    overall_roi: fullTrades.length > 0 ? parseFloat((fullTrades.reduce((s, t) => s + t.pnl, 0) / initBal * 100).toFixed(2)) : 0,
    max_drawdown: parseFloat(Math.abs(maxDdPct * initBal / 100).toFixed(2)),
    max_drawdown_pct: parseFloat(maxDdPct.toFixed(2)),
    current_balance: parseFloat(balance.toFixed(2)),
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
    { label: "Net P&L", key: "pnl" },
    { label: "ROI", key: "pnl_pct" },
    { label: "R", key: "r_multiple" },
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
  const getSortVal = (t, k) => {
    if (k === "entry_date")
      return t.entry_date;
    if (k === "exit_date")
      return t.exit_date;
    if (k === "symbol")
      return t.symbol;
    if (k === "pnl")
      return t.pnl;
    if (k === "pnl_pct")
      return t.pnl_pct;
    if (k === "r_multiple")
      return t.r_multiple;
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
        { v: fmtUSD(t.pnl), c: pc(t.pnl), bold: true },
        { v: `${fmt(t.pnl_pct, 2)}%`, c: pc(t.pnl) },
        { v: `${t.r_multiple}R`, c: pc(t.r_multiple) },
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
function renderStatsBar(parent, stats, trades, onShowTrades, openFile) {
  const wrap = div(parent, `display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:12px 16px;`);
  const items = [
    { label: "Net P&L", value: fmtUSD(stats.net_pnl), color: pc(stats.net_pnl) },
    { label: "Win Rate", value: `${stats.win_rate}%`, color: stats.win_rate >= 50 ? C.green : C.red },
    { label: "Profit Factor", value: stats.profit_factor === Infinity ? "\u221E" : String(stats.profit_factor), color: stats.profit_factor >= 1 ? C.green : C.red },
    { label: "Day Win %", value: `${stats.day_win_rate}%`, color: stats.day_win_rate >= 50 ? C.green : C.red },
    { label: "Avg Win", value: fmtUSD(stats.avg_win), color: C.green },
    { label: "Avg Loss", value: fmtUSD(stats.avg_loss), color: C.red },
    { label: "Largest Win", value: fmtUSD(stats.largest_win), color: C.green, click: () => stats.largest_win_trade && openFile(stats.largest_win_trade.exit_file) },
    { label: "Largest Loss", value: fmtUSD(-stats.largest_loss), color: C.red, click: () => stats.largest_loss_trade && openFile(stats.largest_loss_trade.exit_file) },
    { label: "Avg W/L Ratio", value: String(stats.avg_win_loss_ratio), color: stats.avg_win_loss_ratio >= 1 ? C.green : C.red, extra: stats.avg_win > 0 || stats.avg_loss > 0 ? { win: stats.avg_win, loss: stats.avg_loss } : null },
    { label: "Avg R", value: `${stats.avg_r_multiple}R`, color: stats.avg_r_multiple >= 0 ? C.green : C.red },
    { label: "Max DD", value: `${stats.max_drawdown_pct.toFixed(1)}%`, color: C.red },
    { label: "ROI", value: `${stats.overall_roi}%`, color: pc(stats.overall_roi) },
    { label: "Balance", value: fmtUSD(stats.current_balance), color: C.blue },
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
  const presets = [
    { label: "All", days: 0 },
    { label: "1W", days: 7 },
    { label: "1M", days: 30 },
    { label: "3M", days: 90 },
    { label: "6M", days: 180 },
    { label: "YTD", days: -1 }
  ];
  const isActive = (days) => {
    if (days === 0)
      return !filters.date_from && !filters.date_to;
    if (days === -1) {
      const ytd = new Date();
      ytd.setMonth(0);
      ytd.setDate(1);
      return filters.date_from === ytd.toISOString().split("T")[0] && !filters.date_to;
    }
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
        const ytd = new Date();
        ytd.setMonth(0);
        ytd.setDate(1);
        onChange(__spreadProps(__spreadValues({}, filters), { date_from: ytd.toISOString().split("T")[0], date_to: void 0 }));
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
function renderDashboard(container, stats, trades, events, filters, onFilterChange, openFile) {
  container.style.cssText = `background:${C.bg};min-height:100%;font-family:${F};color:${C.text};`;
  let showTradesList = false;
  let tradeListData = trades;
  const redraw = () => {
    container.empty();
    container.style.cssText = `background:${C.bg};min-height:100%;font-family:${F};color:${C.text};`;
    const hdr = div(container, `display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid ${C.border};background:${C.card};`);
    hdr.createEl("div", { text: "Trading Dashboard", attr: { style: `color:${C.text};font-size:18px;font-weight:700;font-family:${F};` } });
    const hRight = div(hdr, "display:flex;align-items:center;gap:8px;");
    hRight.createEl("div", { text: `${trades.length} total trades`, attr: { style: `color:${C.muted};font-size:11px;` } });
    const actTab = `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const inTab = `background:transparent;color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const dashBtn = hRight.createEl("button", { text: "Dashboard", attr: { style: !showTradesList ? actTab : inTab } });
    const tradesBtn = hRight.createEl("button", { text: "Trades", attr: { style: showTradesList ? actTab : inTab } });
    dashBtn.addEventListener("click", () => {
      showTradesList = false;
      redraw();
    });
    tradesBtn.addEventListener("click", () => {
      showTradesList = true;
      tradeListData = trades;
      redraw();
    });
    const onShowTrades = (t) => {
      showTradesList = true;
      tradeListData = t;
      redraw();
    };
    renderFilters(container, trades, filters, (f) => {
      onFilterChange(f);
    });
    if (showTradesList) {
      renderTradesList(div(container, "padding:16px;"), tradeListData, openFile);
      return;
    }
    renderStatsBar(container, stats, trades, onShowTrades, openFile);
    const g1 = div(container, "display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const eq = card(g1);
    addExpandBtn(eq, "Equity Curve", (c) => renderEquity(c, stats.equity_curve, 900));
    cardTitle(eq, "Equity Curve");
    renderEquity(eq, stats.equity_curve);
    const dd = card(g1);
    addExpandBtn(dd, "Drawdown", (c) => renderDrawdown(c, stats.drawdown_curve, 900));
    cardTitle(dd, "Drawdown");
    renderDrawdown(dd, stats.drawdown_curve);
    const g2 = div(container, "display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const mb = card(g2);
    cardTitle(mb, "Monthly P&L");
    renderMonthlyBars(mb, stats.monthly_pnl, trades, onShowTrades);
    const sk = card(g2);
    cardTitle(sk, "Win/Loss Streak");
    renderStreak(sk, stats.streak, trades, onShowTrades);
    const lw = card(container, "margin:12px 16px 0;");
    cardTitle(lw, "Largest Win & Loss");
    renderLargest(lw, stats, openFile);
    const cal = card(container, "margin:12px 16px 0;overflow-x:auto;");
    cardTitle(cal, "P&L Calendar");
    renderCalendar(cal, stats.daily_pnl, stats.weekly_pnl, trades, openFile, onShowTrades);
    const g3 = div(container, "display:grid;grid-template-columns:3fr 2fr;gap:12px;padding:12px 16px 0;");
    const ts = card(g3);
    cardTitle(ts, "Entry Time Performance (13:00\u201322:00, 30min)");
    renderTimeSlots(ts, stats.pnl_by_slot);
    const dr = card(g3);
    cardTitle(dr, "Trade Duration");
    renderDuration(dr, stats.duration_by_outcome);
    const st = card(container, "margin:12px 16px 0;");
    cardTitle(st, "Strategy Breakdown");
    renderStrategyTable(st, stats, trades, onShowTrades);
    const gr = card(container, "margin:12px 16px 0;");
    cardTitle(gr, "Grade Breakdown");
    renderGrades(gr, stats, trades, onShowTrades);
    const mc = card(container, "margin:12px 16px 16px;");
    addExpandBtn(mc, "Market Conditions vs P&L", (c) => renderCorrelation(c, stats.market_correlation, 900));
    cardTitle(mc, "Market Conditions vs P&L");
    renderCorrelation(mc, stats.market_correlation);
  };
  redraw();
}

// src/main.ts
var DASHBOARD_VIEW = "trading-journal-dashboard";
var SIDEBAR_VIEW = "trading-journal-sidebar";
var DashboardView = class extends import_obsidian3.ItemView {
  constructor(leaf, cache) {
    super(leaf);
    this.filters = {};
    this.unsubscribe = null;
    this.cache = cache;
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
    const container = this.containerEl.children[1];
    container.empty();
    container.style.cssText = "padding:0;overflow-y:auto;height:100%;";
    const allTrades = this.cache.getTrades();
    const events = this.cache.getAccountEvents();
    const filtered = filterTrades(allTrades, this.filters);
    const stats = calcStats(allTrades, events, this.filters);
    renderDashboard(
      container,
      stats,
      filtered,
      events,
      this.filters,
      (f) => {
        this.filters = f;
        this.render();
      },
      (filePath) => this.openFile(filePath)
    );
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
var SidebarView = class extends import_obsidian3.ItemView {
  constructor(leaf, cache) {
    super(leaf);
    this.unsubscribe = null;
    this.cache = cache;
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
      { label: "Max DD", value: `${stats.max_drawdown_pct.toFixed(1)}%`, color: "#f87171" },
      { label: "ROI", value: `${stats.overall_roi}%`, color: stats.overall_roi >= 0 ? "#4ade80" : "#f87171" },
      { label: "Balance", value: `$${stats.current_balance.toFixed(2)}`, color: "#60a5fa" }
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
        const posWrap = wrap.createEl("div", { attr: { style: "padding:6px 0;border-bottom:1px solid var(--background-modifier-border);" } });
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
          const row3 = posWrap.createEl("div", { attr: { style: "display:flex;justify-content:space-between;" } });
          row3.createEl("span", { text: "Target SL", attr: { style: "color:var(--text-faint);font-size:10px;" } });
          row3.createEl("span", { text: `$${r.target_sl}`, attr: { style: "color:#f87171;font-size:10px;font-weight:700;" } });
        }
      });
    }
    wrap.createEl("div", { text: `\u21BB ${new Date(this.cache.getLastUpdated()).toLocaleTimeString()}`, attr: { style: "color:var(--text-faint);font-size:10px;margin-top:10px;text-align:center;" } });
  }
};
var TradingJournalPlugin = class extends import_obsidian3.Plugin {
  onload() {
    return __async(this, null, function* () {
      this.cache = new CacheManager(this);
      yield this.cache.initialize();
      this.registerView(DASHBOARD_VIEW, (leaf) => new DashboardView(leaf, this.cache));
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
          new import_obsidian3.Notice("Debug data dumped to console (Ctrl+Shift+I to open DevTools)");
        }
      });
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
