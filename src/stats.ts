import { Trade, AccountEvent, TradeStats, StrategyStats, GradeStats, TradeFilters, TradeGrade, StreakInfo } from "./types";

// Count unique trade openings — strips #1 #2 suffixes from partial exits
export function countUniqueTrades(trades: Trade[]): number {
  const ids = new Set(trades.map(t => t.trade_id.replace(/#\d+$/, "")));
  return ids.size;
}

export function filterTrades(trades: Trade[], f: TradeFilters): Trade[] {
  return trades.filter(t => {
    if (f.date_from && t.entry_date < f.date_from) return false;
    if (f.date_to   && t.entry_date > f.date_to)   return false;
    if (f.account   && t.account   !== f.account)   return false;
    if (f.strategy  && t.strategy  !== f.strategy)  return false;
    if (f.grade     && t.grade     !== f.grade)     return false;
    if (f.dir       && t.dir       !== f.dir)       return false;
    if (f.symbol    && t.symbol.toUpperCase() !== f.symbol.toUpperCase()) return false;
    return true;
  });
}

// ─── Aggregate partial exits into full trades for stats ──────────────────────
// Groups all exit records by original trade_id (stripping #1, #2 suffix)
// Returns only fully closed trades with combined P&L
function aggregateFullTrades(trades: Trade[]): { pnl: number; r_multiple: number; is_winner: boolean; pnl_pct: number }[] {
  const byId: Record<string, Trade[]> = {};
  trades.forEach(t => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    if (!byId[baseId]) byId[baseId] = [];
    byId[baseId].push(t);
  });

  const result: { pnl: number; r_multiple: number; is_winner: boolean; pnl_pct: number }[] = [];

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

// ─── Streak ───────────────────────────────────────────────────────────────────
function buildStreak(trades: Trade[]): StreakInfo {
  if (!trades.length) return { last5: [], current_streak: 0, longest_win: 0, longest_loss: 0, momentum: "none" };

  const sorted = [...trades].sort((a,b) => `${a.exit_date}${a.exit_time}`.localeCompare(`${b.exit_date}${b.exit_time}`));
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
  ev.forEach(e => { if (e.type==="deposit") cf[e.date]=(cf[e.date]??0)+e.amount; if (e.type==="withdrawal") cf[e.date]=(cf[e.date]??0)-e.amount; });
  const curve = [{ date: trades[0]?.entry_date ?? "", value: bal }];
  for (const t of trades) {
    if (cf[t.exit_date]) { bal += cf[t.exit_date]; delete cf[t.exit_date]; }
    bal += t.pnl;
    curve.push({ date: t.exit_date, value: parseFloat(bal.toFixed(2)) });
  }
  return curve;
}

function buildDrawdown(equity: { date: string; value: number }[]): { date: string; value: number }[] {
  let peak = equity[0]?.value ?? 0;
  return equity.map(p => {
    if (p.value > peak) peak = p.value;
    return { date: p.date, value: parseFloat((peak > 0 ? ((p.value-peak)/peak)*100 : 0).toFixed(2)) };
  });
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
  const ft      = filterTrades(trades, filters);
  const empty   = (): TradeStats => ({
    net_pnl:0, trade_count:0, exit_count:0, win_count:0, loss_count:0, win_rate:0, profit_factor:0, avg_win_loss_ratio:0,
    avg_win:0, avg_loss:0, avg_r_multiple:0, largest_win:0, largest_loss:0,
    day_win_rate:0, overall_roi:0, max_drawdown:0, max_drawdown_pct:0, current_balance:0,
    streak: { last5:[], current_streak:0, longest_win:0, longest_loss:0, momentum:"none" },
    equity_curve:[], drawdown_curve:[], daily_pnl:[], weekly_pnl:[], monthly_pnl:[],
    pnl_by_slot:[], duration_by_outcome:[], pnl_by_strategy:{},
    pnl_by_grade: buildGradeStats([]), market_correlation:[],
  });
  if (!ft.length) return empty();

  // All exit records (for daily P&L, equity curve, calendar)
  const wins    = ft.filter(t=>t.is_winner);
  const losses  = ft.filter(t=>!t.is_winner);
  const net_pnl = parseFloat(ft.reduce((s,t)=>s+t.pnl,0).toFixed(2));
  const daily   = buildDailyPnl(ft);
  const winDays = daily.filter(d=>d.pnl>0).length;
  const equity  = buildEquity(ft, accountEvents, filters.account);
  const dd      = buildDrawdown(equity);
  const maxDdPct= Math.abs(Math.min(...dd.map(d=>d.value)));
  const initBal = accountEvents.filter(e=>(!filters.account||e.account===filters.account)&&e.type==="initial").reduce((s,e)=>s+e.amount,0)||10000;
  const balance = equity[equity.length-1]?.value ?? initBal;

  // Fully closed aggregated trades (for win rate, PF, avg win/loss, avg R, ROI)
  const fullTrades = aggregateFullTrades(ft);
  const ftWins     = fullTrades.filter(t=>t.is_winner);
  const ftLosses   = fullTrades.filter(t=>!t.is_winner);
  const gw         = ftWins.reduce((s,t)=>s+t.pnl,0);
  const gl         = Math.abs(ftLosses.reduce((s,t)=>s+t.pnl,0));

  // Fully closed exit records — is_partial=false means this exit fully closes the position
  // Used for: largest win/loss, time slots, duration, strategy, grade, market correlation
  const closedExits = ft.filter(t => !t.is_partial);

  // For largest win/loss: aggregate P&L per base trade_id across all exits,
  // then find the last exit record to use for the note link
  const pnlByBase: Record<string, number> = {};
  const lastExitByBase: Record<string, Trade> = {};
  ft.forEach(t => {
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
    trade_count:         countUniqueTrades(ft),
    exit_count:          ft.length,
    win_count:           ftWins.length,
    loss_count:          ftLosses.length,
    win_rate:            fullTrades.length>0?parseFloat((ftWins.length/fullTrades.length*100).toFixed(1)):0,
    profit_factor:       gl>0?parseFloat((gw/gl).toFixed(2)):gw>0?Infinity:0,
    avg_win:             ftWins.length>0?parseFloat((gw/ftWins.length).toFixed(2)):0,
    avg_loss:            ftLosses.length>0?parseFloat((gl/ftLosses.length).toFixed(2)):0,
    avg_r_multiple:      fullTrades.length>0?parseFloat((fullTrades.reduce((s,t)=>s+t.r_multiple,0)/fullTrades.length).toFixed(2)):0,
    avg_win_loss_ratio:  ftWins.length>0&&ftLosses.length>0?parseFloat(((gw/ftWins.length)/(gl/ftLosses.length)).toFixed(2)):0,
    largest_win:         largestWinPnl  > 0 ? largestWinPnl  : 0,
    largest_win_trade:   largestWinTrade,
    largest_loss:        largestLossPnl < 0 ? Math.abs(largestLossPnl) : 0,
    largest_loss_trade:  largestLossTrade,
    day_win_rate:        daily.length>0?parseFloat((winDays/daily.length*100).toFixed(1)):0,
    overall_roi:         fullTrades.length>0?parseFloat((fullTrades.reduce((s,t)=>s+t.pnl,0)/initBal*100).toFixed(2)):0,
    max_drawdown:        parseFloat(Math.abs(maxDdPct*initBal/100).toFixed(2)),
    max_drawdown_pct:    parseFloat(maxDdPct.toFixed(2)),
    current_balance:     parseFloat(balance.toFixed(2)),
    streak:              buildStreak(ft),
    equity_curve:        equity,
    drawdown_curve:      dd,
    daily_pnl:           daily,
    weekly_pnl:          buildWeeklyPnl(ft),
    monthly_pnl:         buildMonthlyPnl(ft),
    pnl_by_slot:         buildPnlBySlot(closedExits),       // fully closed only
    duration_by_outcome: buildDuration(closedExits),         // fully closed only
    pnl_by_strategy:     buildStrategyStats(closedExits),    // fully closed only
    pnl_by_grade:        buildGradeStats(closedExits),       // fully closed only
    market_correlation:  closedExits
      .filter(t=>t.market_score!==undefined)
      .map(t=>({ score:t.market_score!, pnl:t.pnl, date:t.entry_date, symbol:t.symbol })),
  };
}
