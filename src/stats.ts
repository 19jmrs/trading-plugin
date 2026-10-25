import { Trade, AccountEvent, TradeStats, StrategyStats, GradeStats, TradeFilters, TradeGrade, StreakInfo, MarketConditionLabel, SetupScoreBucketStat, MarketConditionStat, WeekdayStat, DailyStreakStats, HoldBucketFilter, TradeStatusFilter } from "./types";

// Count unique trade openings — strips #1 #2 suffixes from partial exits
export function countUniqueTrades(trades: Trade[]): number {
  const ids = new Set(trades.map(t => t.trade_id.replace(/#\d+$/, "")));
  return ids.size;
}

function marketConditionLabel(score?: number): MarketConditionLabel | null {
  if (score === undefined || score === null || !Number.isFinite(score)) return null;
  if (score <= 20) return "Bad";
  if (score <= 45) return "Poor";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Good";
  return "Excellent";
}

function weekdayName(dateStr: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][localDate(dateStr).getDay()];
}

function matchesHoldBucket(minutes: number, bucket?: HoldBucketFilter): boolean {
  if (!bucket) return true;
  if (bucket === "same-day") return minutes < 24 * 60;
  if (bucket === "2-5d") return minutes >= 24 * 60 && minutes < 6 * 24 * 60;
  if (bucket === "1-2w") return minutes >= 6 * 24 * 60 && minutes < 15 * 24 * 60;
  return minutes >= 15 * 24 * 60;
}

function computeOpenBaseIds(trades: Trade[]): Set<string> {
  const latestByBase = new Map<string, Trade>();
  trades.forEach(t => latestByBase.set(t.trade_id.replace(/#\d+$/, ""), t));
  return new Set([...latestByBase.entries()].filter(([, t]) => t.is_partial).map(([id]) => id));
}

function matchesStatus(t: Trade, openBaseIds: Set<string>, status?: TradeStatusFilter): boolean {
  if (!status) return true;
  const baseId = t.trade_id.replace(/#\d+$/, "");
  if (status === "open") return openBaseIds.has(baseId);
  if (status === "partial") return t.is_partial && !openBaseIds.has(baseId);
  return !t.is_partial && !openBaseIds.has(baseId);
}

function tradePassesNonDateFilters(t: Trade, f: TradeFilters, dateMode: "entry" | "exit", openBaseIds: Set<string>): boolean {
  if (f.account   && t.account   !== f.account)   return false;
  if (f.strategy  && t.strategy  !== f.strategy)  return false;
  if (f.grade     && t.grade     !== f.grade)     return false;
  if (f.dir       && t.dir       !== f.dir)       return false;
  if (f.symbol    && t.symbol.toUpperCase() !== f.symbol.toUpperCase()) return false;
  if (f.market_condition && marketConditionLabel(t.market_score) !== f.market_condition) return false;
  const weekdayDate = dateMode === "entry" ? t.entry_date : t.exit_date;
  if (f.weekday && weekdayName(weekdayDate) !== f.weekday) return false;
  if (!matchesHoldBucket(t.hold_minutes, f.hold_bucket)) return false;
  if (!matchesStatus(t, openBaseIds, f.status)) return false;
  return true;
}

export function filterTrades(trades: Trade[], f: TradeFilters): Trade[] {
  const openBaseIds = computeOpenBaseIds(trades);
  return trades.filter(t => {
    if (!tradePassesNonDateFilters(t, f, "exit", openBaseIds)) return false;
    if (f.date_from && t.exit_date < f.date_from) return false;
    if (f.date_to   && t.exit_date > f.date_to)   return false;
    return true;
  });
}

export function filterTradesByExitDate(trades: Trade[], f: TradeFilters): Trade[] {
  return filterTrades(trades, f);
}

interface FullTradeAggregate {
  pnl: number;
  r_multiple: number;
  is_winner: boolean;
  pnl_pct: number;
  hold_minutes: number;
  trade_score: number;
  market_score?: number;
  total_fees: number;
}

// ─── Aggregate partial exits into full trades for stats ──────────────────────
// Groups all exit records by original trade_id (stripping #1, #2 suffix)
// Returns only fully closed trades with combined P&L
function aggregateFullTrades(trades: Trade[]): FullTradeAggregate[] {
  const byId: Record<string, Trade[]> = {};
  trades.forEach(t => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    if (!byId[baseId]) byId[baseId] = [];
    byId[baseId].push(t);
  });

  const result: FullTradeAggregate[] = [];

  Object.values(byId).forEach(group => {
    // Only include if all exits are non-partial (i.e. last exit is not partial)
    // is_partial on last exit = true means still open residual → skip
    const lastExit = group[group.length - 1];
    if (lastExit.is_partial) return; // still open, don't count

    const totalPnl     = group.reduce((s, t) => s + t.pnl, 0);
    const totalSize    = group.reduce((s, t) => s + t.filled_size, 0);
    const entryCost    = group[0].entry_price * totalSize;
    const pnl_pct      = entryCost > 0 ? (totalPnl / entryCost) * 100 : 0;
    // R multiple: use first exit's target_sl and entry price
    const riskPerUnit  = Math.abs(group[0].entry_price - group[0].target_sl);
    const r_multiple   = riskPerUnit > 0 && totalSize > 0
      ? parseFloat((totalPnl / (riskPerUnit * group[0].entry_size)).toFixed(2))
      : 0;

    result.push({
      pnl:        parseFloat(totalPnl.toFixed(2)),
      r_multiple,
      is_winner:  totalPnl > 0,
      pnl_pct:    parseFloat(pnl_pct.toFixed(4)),
      hold_minutes: Math.max(...group.map(t => t.hold_minutes)),
      trade_score: group[0].trade_score,
      market_score: group[0].market_score,
      total_fees: parseFloat((group[0].entry_fees + group.reduce((s, t) => s + t.exit_fees, 0)).toFixed(2)),
    });
  });

  return result;
}

// Timezone-safe date parsing
function localDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}

function weekKey(dateStr: string): string {
  const d   = localDate(dateStr);
  const dow = d.getDay();
  const off = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
  return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function toDateTimeMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h = 0, min = 0] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

// ─── Streak ───────────────────────────────────────────────────────────────────
function buildStreak(trades: Trade[]): StreakInfo {
  if (!trades.length) return { last5: [], current_streak: 0, longest_win: 0, longest_loss: 0, momentum: "none" };

  const sorted = [...trades].sort((a, b) => toDateTimeMs(a.exit_date, a.exit_time) - toDateTimeMs(b.exit_date, b.exit_time));
  const last5  = sorted.slice(-5).reverse().map(t => ({ trade: t, is_winner: t.is_winner }));

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

  const wins5 = last5.filter(s => s.is_winner).length;
  const momentum: StreakInfo["momentum"] =
    last5.length < 2 ? "none" :
    cur >= 3         ? "hot"  :
    cur <= -3        ? "cold" :
    wins5 >= 3       ? "hot"  :
    wins5 <= 1       ? "cold" : "mixed";

  return { last5, current_streak: cur, longest_win: longestW, longest_loss: longestL, momentum };
}

// ─── Equity curve ─────────────────────────────────────────────────────────────
function buildEquity(trades: Trade[], events: AccountEvent[], account?: string): { date: string; value: number }[] {
  const ev = account ? events.filter(e => e.account === account) : events;
  let bal  = ev.filter(e => e.type === "initial").reduce((s,e) => s+e.amount, 0) || 10000;
  const cf: Record<string, number> = {};
  ev.forEach(e => {
    if (e.type === "deposit") cf[e.date] = (cf[e.date] ?? 0) + e.amount;
    if (e.type === "withdrawal") cf[e.date] = (cf[e.date] ?? 0) - e.amount;
  });

  const tradeByDate: Record<string, number> = {};
  [...trades]
    .sort((a, b) => toDateTimeMs(a.exit_date, a.exit_time) - toDateTimeMs(b.exit_date, b.exit_time))
    .forEach(t => { tradeByDate[t.exit_date] = (tradeByDate[t.exit_date] ?? 0) + t.pnl; });

  const dates = [...new Set([...Object.keys(cf), ...Object.keys(tradeByDate)])].sort((a, b) => a.localeCompare(b));
  const startDate = dates[0] ?? trades[0]?.entry_date ?? "";
  const curve = [{ date: startDate, value: parseFloat(bal.toFixed(2)) }];

  dates.forEach(date => {
    if (cf[date]) bal += cf[date];
    if (tradeByDate[date]) bal += tradeByDate[date];
    curve.push({ date, value: parseFloat(bal.toFixed(2)) });
  });

  return curve;
}

function buildDrawdown(equity: { date: string; value: number }[]): { date: string; value: number }[] {
  let peak = equity[0]?.value ?? 0;
  return equity.map(p => {
    if (p.value > peak) peak = p.value;
    return { date: p.date, value: parseFloat((peak > 0 ? ((p.value-peak)/peak)*100 : 0).toFixed(2)) };
  });
}

function sliceEquityCurveByDate(
  equity: { date: string; value: number }[],
  dateFrom?: string,
  dateTo?: string,
): { date: string; value: number }[] {
  if (!dateFrom && !dateTo) return equity.filter(p => !!p.date);

  const filtered = equity.filter(p => {
    if (!p.date) return false;
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  if (dateFrom) {
    const prior = [...equity].reverse().find(p => p.date && p.date < dateFrom);
    if (prior && !filtered.some(p => p.date === dateFrom)) {
      filtered.unshift({ date: dateFrom, value: prior.value });
    }
  }

  return filtered;
}

// ─── Daily / Weekly / Monthly P&L ────────────────────────────────────────────
function buildDailyPnl(trades: Trade[]): { date: string; pnl: number; count: number }[] {
  const m: Record<string, { pnl: number; count: number }> = {};
  trades.forEach(t => {
    if (!m[t.exit_date]) m[t.exit_date] = { pnl: 0, count: 0 };
    m[t.exit_date].pnl   += t.pnl;
    m[t.exit_date].count += 1;
  });
  return Object.entries(m).map(([d,v]) => ({ date:d, pnl:parseFloat(v.pnl.toFixed(2)), count:v.count })).sort((a,b)=>a.date.localeCompare(b.date));
}

function buildWeeklyPnl(trades: Trade[]): { week: string; pnl: number; count: number }[] {
  const m: Record<string, { pnl: number; count: number }> = {};
  trades.forEach(t => {
    const wk = weekKey(t.exit_date);
    if (!m[wk]) m[wk] = { pnl: 0, count: 0 };
    m[wk].pnl   += t.pnl;
    m[wk].count += 1;
  });
  return Object.entries(m).map(([w,v]) => ({ week:w, pnl:parseFloat(v.pnl.toFixed(2)), count:v.count })).sort((a,b)=>a.week.localeCompare(b.week));
}

function buildMonthlyPnl(trades: Trade[]): { month: string; pnl: number; count: number }[] {
  const m: Record<string, { pnl: number; count: number }> = {};
  trades.forEach(t => {
    const mk = monthKey(t.exit_date);
    if (!m[mk]) m[mk] = { pnl: 0, count: 0 };
    m[mk].pnl   += t.pnl;
    m[mk].count += 1;
  });
  return Object.entries(m).map(([mo,v]) => ({ month:mo, pnl:parseFloat(v.pnl.toFixed(2)), count:v.count })).sort((a,b)=>a.month.localeCompare(b.month));
}

// ─── Time slots 13:00–22:00 in 30min buckets ─────────────────────────────────
function buildPnlBySlot(trades: Trade[]): { slot: string; pnl: number; winners: number; losers: number }[] {
  const slots: { slot: string; pnl: number; winners: number; losers: number }[] = [];
  for (let h = 13; h < 22; h++) {
    for (const m of [0, 30]) {
      const label = `${String(h).padStart(2,"0")}:${m === 0 ? "00" : "30"}`;
      slots.push({ slot: label, pnl: 0, winners: 0, losers: 0 });
    }
  }
  // Last slot: 22:00
  slots.push({ slot: "22:00", pnl: 0, winners: 0, losers: 0 });

  trades.forEach(t => {
    const [h, min] = t.entry_time.split(":").map(Number);
    if (h < 13 || h > 22) return;
    const slotH   = h;
    const slotM   = min < 30 ? 0 : 30;
    const label   = `${String(slotH).padStart(2,"0")}:${slotM === 0 ? "00" : "30"}`;
    const slot    = slots.find(s => s.slot === label);
    if (!slot) return;
    slot.pnl     += t.pnl;
    t.is_winner ? slot.winners++ : slot.losers++;
  });

  return slots.map(s => ({ ...s, pnl: parseFloat(s.pnl.toFixed(2)) }));
}

// ─── Duration buckets ─────────────────────────────────────────────────────────
function buildDuration(trades: Trade[]): { bucket: string; winners: number; losers: number }[] {
  const buckets = [
    { label:"<1h",  min:0,   max:60    },
    { label:"1-4h", min:60,  max:240   },
    { label:"4-8h", min:240, max:480   },
    { label:"1-3d", min:480, max:4320  },
    { label:">3d",  min:4320,max:Infinity },
  ];
  return buckets.map(b => {
    const t = trades.filter(t => t.hold_minutes >= b.min && t.hold_minutes < b.max);
    return { bucket:b.label, winners:t.filter(t=>t.is_winner).length, losers:t.filter(t=>!t.is_winner).length };
  });
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildWeekdayStats(trades: Trade[]): WeekdayStat[] {
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return order.map(day => {
    const rows = trades.filter(t => weekdayName(t.exit_date) === day);
    const wins = rows.filter(t => t.is_winner).length;
    return {
      weekday: day,
      net_pnl: parseFloat(rows.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)),
      trade_count: rows.length,
      win_rate: rows.length ? parseFloat(((wins / rows.length) * 100).toFixed(1)) : 0,
    };
  });
}

function buildDailyStreakStats(daily: { date: string; pnl: number }[]): DailyStreakStats {
  let currentGreen = 0, currentRed = 0, longestGreen = 0, longestRed = 0, greenRun = 0, redRun = 0;
  daily.forEach(d => {
    if (d.pnl > 0) {
      greenRun += 1;
      redRun = 0;
      longestGreen = Math.max(longestGreen, greenRun);
    } else if (d.pnl < 0) {
      redRun += 1;
      greenRun = 0;
      longestRed = Math.max(longestRed, redRun);
    } else {
      greenRun = 0;
      redRun = 0;
    }
  });
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].pnl > 0 && currentRed === 0) currentGreen += 1;
    else if (daily[i].pnl < 0 && currentGreen === 0) currentRed += 1;
    else break;
  }
  return { current_green: currentGreen, current_red: currentRed, longest_green: longestGreen, longest_red: longestRed };
}

function buildSetupScoreBuckets(trades: FullTradeAggregate[]): SetupScoreBucketStat[] {
  const buckets = [
    { label: "40+", min: 40, max: Infinity },
    { label: "30-39", min: 30, max: 40 },
    { label: "15-29", min: 15, max: 30 },
    { label: "<15", min: -Infinity, max: 15 },
  ];
  return buckets.map(bucket => {
    const rows = trades.filter(t => t.trade_score >= bucket.min && t.trade_score < bucket.max);
    const wins = rows.filter(t => t.is_winner).length;
    return {
      label: bucket.label,
      trade_count: rows.length,
      win_rate: rows.length ? parseFloat(((wins / rows.length) * 100).toFixed(1)) : 0,
      net_pnl: parseFloat(rows.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)),
      avg_r: rows.length ? parseFloat((rows.reduce((sum, t) => sum + t.r_multiple, 0) / rows.length).toFixed(2)) : 0,
      avg_pct: rows.length ? parseFloat((rows.reduce((sum, t) => sum + t.pnl_pct, 0) / rows.length).toFixed(2)) : 0,
    };
  });
}

function buildMarketConditionStats(trades: FullTradeAggregate[]): MarketConditionStat[] {
  const order: MarketConditionLabel[] = ["Bad", "Poor", "Neutral", "Good", "Excellent"];
  return order.map(label => {
    const rows = trades.filter(t => marketConditionLabel(t.market_score) === label);
    const wins = rows.filter(t => t.is_winner).length;
    return {
      label,
      trade_count: rows.length,
      win_rate: rows.length ? parseFloat(((wins / rows.length) * 100).toFixed(1)) : 0,
      net_pnl: parseFloat(rows.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)),
      avg_r: rows.length ? parseFloat((rows.reduce((sum, t) => sum + t.r_multiple, 0) / rows.length).toFixed(2)) : 0,
      avg_pct: rows.length ? parseFloat((rows.reduce((sum, t) => sum + t.pnl_pct, 0) / rows.length).toFixed(2)) : 0,
      expectancy_r: rows.length ? parseFloat((rows.reduce((sum, t) => sum + t.r_multiple, 0) / rows.length).toFixed(2)) : 0,
    };
  });
}

// ─── Strategy / Grade stats ───────────────────────────────────────────────────
function buildStrategyStats(trades: Trade[]): Record<string, StrategyStats> {
  const m: Record<string, Trade[]> = {};
  trades.forEach(t => { const s=t.strategy||"Unknown"; if(!m[s]) m[s]=[]; m[s].push(t); });
  const r: Record<string, StrategyStats> = {};
  Object.entries(m).forEach(([s,ts]) => {
    const w=ts.filter(t=>t.is_winner), l=ts.filter(t=>!t.is_winner);
    const gw=w.reduce((a,t)=>a+t.pnl,0), gl=Math.abs(l.reduce((a,t)=>a+t.pnl,0));
    r[s] = { strategy:s, net_pnl:parseFloat(ts.reduce((a,t)=>a+t.pnl,0).toFixed(2)), trade_count:ts.length, win_rate:ts.length>0?parseFloat((w.length/ts.length*100).toFixed(1)):0, profit_factor:gl>0?parseFloat((gw/gl).toFixed(2)):gw>0?Infinity:0, avg_r:ts.length>0?parseFloat((ts.reduce((a,t)=>a+t.r_multiple,0)/ts.length).toFixed(2)):0 };
  });
  return r;
}

function buildGradeStats(trades: Trade[]): Record<TradeGrade, GradeStats> {
  const r = {} as Record<TradeGrade, GradeStats>;
  (["A","B","C","D"] as TradeGrade[]).forEach(g => {
    const ts=trades.filter(t=>t.grade===g), w=ts.filter(t=>t.is_winner);
    r[g] = { grade:g, net_pnl:parseFloat(ts.reduce((a,t)=>a+t.pnl,0).toFixed(2)), trade_count:ts.length, win_rate:ts.length>0?parseFloat((w.length/ts.length*100).toFixed(1)):0, avg_r:ts.length>0?parseFloat((ts.reduce((a,t)=>a+t.r_multiple,0)/ts.length).toFixed(2)):0 };
  });
  return r;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function calcStats(trades: Trade[], accountEvents: AccountEvent[], filters: TradeFilters): TradeStats {
  const cohortTrades   = filterTrades(trades, filters);
  const realizedTrades = cohortTrades;
  const initBal = accountEvents.filter(e=>(!filters.account||e.account===filters.account)&&e.type==="initial").reduce((s,e)=>s+e.amount,0)||10000;
  const allEquity = buildEquity(trades.filter(t => !filters.account || t.account === filters.account), accountEvents, filters.account);
  const currentBalance = allEquity[allEquity.length-1]?.value ?? initBal;
  const empty   = (): TradeStats => ({
    net_pnl:0, trade_count:0, exit_count:0, win_count:0, loss_count:0, win_rate:0, profit_factor:0, avg_win_loss_ratio:0,
    avg_win:0, avg_loss:0, avg_win_pct:0, avg_loss_pct:0, median_win:0, median_loss:0, median_r:0, expectancy_pnl:0, expectancy_r:0,
    avg_r_multiple:0, avg_r_win:0, avg_r_loss:0, gain_to_pain:0, total_fees:0, fees_pct_gross_profit:0, avg_fees_per_trade:0, largest_win:0, largest_loss:0,
    day_win_rate:0, overall_roi:0, max_drawdown:0, max_drawdown_pct:0, current_balance:parseFloat(currentBalance.toFixed(2)),
    streak: { last5:[], current_streak:0, longest_win:0, longest_loss:0, momentum:"none" },
    equity_curve:[], drawdown_curve:[], daily_pnl:[], weekly_pnl:[], monthly_pnl:[], weekday_stats:[], daily_streaks:{ current_green:0, current_red:0, longest_green:0, longest_red:0 },
    pnl_by_slot:[], duration_by_outcome:[], avg_hold_win_minutes:0, avg_hold_loss_minutes:0, median_hold_win_minutes:0, median_hold_loss_minutes:0, pnl_by_strategy:{},
    pnl_by_grade: buildGradeStats([]), setup_score_buckets:[], market_condition_stats:[], market_correlation:[],
  });
  if (!cohortTrades.length && !realizedTrades.length) return empty();

  // Selected-period metrics (exit-date based)
  const net_pnl = parseFloat(realizedTrades.reduce((s,t)=>s+t.pnl,0).toFixed(2));
  const daily   = buildDailyPnl(realizedTrades);
  const winDays = daily.filter(d=>d.pnl>0).length;
  const equity  = sliceEquityCurveByDate(allEquity, filters.date_from, filters.date_to);
  const dd      = buildDrawdown(equity);
  const maxDdPct= dd.length ? Math.abs(Math.min(...dd.map(d=>d.value))) : 0;

  // Trade analytics (also exit-date based for consistency)
  const fullTrades = aggregateFullTrades(cohortTrades);
  const ftWins     = fullTrades.filter(t=>t.is_winner);
  const ftLosses   = fullTrades.filter(t=>!t.is_winner);
  const gw         = ftWins.reduce((s,t)=>s+t.pnl,0);
  const gl         = Math.abs(ftLosses.reduce((s,t)=>s+t.pnl,0));
  const totalFees  = fullTrades.reduce((sum, t) => sum + t.total_fees, 0);
  const weekdayStats = buildWeekdayStats(realizedTrades);
  const dailyStreaks = buildDailyStreakStats(daily);

  // Fully closed exit records — is_partial=false means this exit fully closes the position
  // Used for: largest win/loss, time slots, duration, strategy, grade, market correlation
  const closedExits = cohortTrades.filter(t => !t.is_partial);

  // For largest win/loss: aggregate P&L per base trade_id across all exits,
  // then find the last exit record to use for the note link
  const pnlByBase: Record<string, number> = {};
  const lastExitByBase: Record<string, Trade> = {};
  cohortTrades.forEach(t => {
    const baseId = t.trade_id.replace(/#[0-9]+$/, "");
    pnlByBase[baseId]    = (pnlByBase[baseId] ?? 0) + t.pnl;
    lastExitByBase[baseId] = t; // last one written wins (sorted by entry_date)
  });

  // Find base trade_id with best and worst total P&L among fully closed trades
  const closedBaseIds = new Set(closedExits.map(t => t.trade_id.replace(/#[0-9]+$/, "")));
  let bestBaseId = "", worstBaseId = "", bestPnl = -Infinity, worstPnl = Infinity;
  closedBaseIds.forEach(id => {
    const p = pnlByBase[id] ?? 0;
    if (p > bestPnl)  { bestPnl  = p; bestBaseId  = id; }
    if (p < worstPnl) { worstPnl = p; worstBaseId = id; }
  });

  const largestWinTrade:  Trade | undefined = bestBaseId  ? lastExitByBase[bestBaseId]  : undefined;
  const largestLossTrade: Trade | undefined = worstBaseId ? lastExitByBase[worstBaseId] : undefined;
  const largestWinPnl  = bestBaseId  ? (pnlByBase[bestBaseId]  ?? 0) : 0;
  const largestLossPnl = worstBaseId ? (pnlByBase[worstBaseId] ?? 0) : 0;

  return {
    net_pnl,
    trade_count:         countUniqueTrades(cohortTrades),
    exit_count:          cohortTrades.length,
    win_count:           ftWins.length,
    loss_count:          ftLosses.length,
    win_rate:            fullTrades.length>0?parseFloat((ftWins.length/fullTrades.length*100).toFixed(1)):0,
    profit_factor:       gl>0?parseFloat((gw/gl).toFixed(2)):gw>0?Infinity:0,
    avg_win:             ftWins.length>0?parseFloat((gw/ftWins.length).toFixed(2)):0,
    avg_loss:            ftLosses.length>0?parseFloat((gl/ftLosses.length).toFixed(2)):0,
    avg_win_pct:         ftWins.length>0?parseFloat((ftWins.reduce((s,t)=>s+t.pnl_pct,0)/ftWins.length).toFixed(2)):0,
    avg_loss_pct:        ftLosses.length>0?parseFloat((ftLosses.reduce((s,t)=>s+t.pnl_pct,0)/ftLosses.length).toFixed(2)):0,
    median_win:          ftWins.length>0?parseFloat(median(ftWins.map(t=>t.pnl)).toFixed(2)):0,
    median_loss:         ftLosses.length>0?parseFloat(Math.abs(median(ftLosses.map(t=>t.pnl))).toFixed(2)):0,
    median_r:            fullTrades.length>0?parseFloat(median(fullTrades.map(t=>t.r_multiple)).toFixed(2)):0,
    expectancy_pnl:      fullTrades.length>0?parseFloat((fullTrades.reduce((s,t)=>s+t.pnl,0)/fullTrades.length).toFixed(2)):0,
    expectancy_r:        fullTrades.length>0?parseFloat((fullTrades.reduce((s,t)=>s+t.r_multiple,0)/fullTrades.length).toFixed(2)):0,
    avg_r_multiple:      fullTrades.length>0?parseFloat((fullTrades.reduce((s,t)=>s+t.r_multiple,0)/fullTrades.length).toFixed(2)):0,
    avg_r_win:           ftWins.length>0?parseFloat((ftWins.reduce((s,t)=>s+t.r_multiple,0)/ftWins.length).toFixed(2)):0,
    avg_r_loss:          ftLosses.length>0?parseFloat((ftLosses.reduce((s,t)=>s+t.r_multiple,0)/ftLosses.length).toFixed(2)):0,
    avg_win_loss_ratio:  ftWins.length>0&&ftLosses.length>0?parseFloat(((gw/ftWins.length)/(gl/ftLosses.length)).toFixed(2)):0,
    gain_to_pain:        gl>0?parseFloat((gw/gl).toFixed(2)):gw>0?Infinity:0,
    total_fees:          parseFloat(totalFees.toFixed(2)),
    fees_pct_gross_profit: gw>0?parseFloat(((totalFees/gw)*100).toFixed(2)):0,
    avg_fees_per_trade:  fullTrades.length>0?parseFloat((totalFees/fullTrades.length).toFixed(2)):0,
    largest_win:         largestWinPnl  > 0 ? largestWinPnl  : 0,
    largest_win_trade:   largestWinTrade,
    largest_loss:        largestLossPnl < 0 ? Math.abs(largestLossPnl) : 0,
    largest_loss_trade:  largestLossTrade,
    day_win_rate:        daily.length>0?parseFloat((winDays/daily.length*100).toFixed(1)):0,
    overall_roi:         parseFloat((net_pnl / initBal * 100).toFixed(2)),
    max_drawdown:        parseFloat(Math.abs(maxDdPct*initBal/100).toFixed(2)),
    max_drawdown_pct:    parseFloat(maxDdPct.toFixed(2)),
    current_balance:     parseFloat(currentBalance.toFixed(2)),
    streak:              buildStreak(realizedTrades),
    equity_curve:        equity,
    drawdown_curve:      dd,
    daily_pnl:           daily,
    weekly_pnl:          buildWeeklyPnl(realizedTrades),
    monthly_pnl:         buildMonthlyPnl(realizedTrades),
    weekday_stats:       weekdayStats,
    daily_streaks:       dailyStreaks,
    pnl_by_slot:         buildPnlBySlot(closedExits),       // fully closed only
    duration_by_outcome: buildDuration(closedExits),         // fully closed only
    avg_hold_win_minutes: ftWins.length>0?parseFloat((ftWins.reduce((sum,t)=>sum+t.hold_minutes,0)/ftWins.length).toFixed(2)):0,
    avg_hold_loss_minutes: ftLosses.length>0?parseFloat((ftLosses.reduce((sum,t)=>sum+t.hold_minutes,0)/ftLosses.length).toFixed(2)):0,
    median_hold_win_minutes: ftWins.length>0?parseFloat(median(ftWins.map(t=>t.hold_minutes)).toFixed(2)):0,
    median_hold_loss_minutes: ftLosses.length>0?parseFloat(median(ftLosses.map(t=>t.hold_minutes)).toFixed(2)):0,
    pnl_by_strategy:     buildStrategyStats(closedExits),    // fully closed only
    pnl_by_grade:        buildGradeStats(closedExits),       // fully closed only
    setup_score_buckets: buildSetupScoreBuckets(fullTrades),
    market_condition_stats: buildMarketConditionStats(fullTrades),
    market_correlation:  closedExits
      .filter(t=>t.market_score!==undefined)
      .map(t=>({ score:t.market_score!, pnl:t.pnl, date:t.exit_date, symbol:t.symbol })),
  };
}
