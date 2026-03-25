import { TradeRow, Trade, TradeGrade } from "./types";

function getGrade(score: number): TradeGrade {
  if (score >= 40) return "A";
  if (score >= 30) return "B";
  if (score >= 15) return "C";
  return "D";
}

function calcHoldMinutes(ed: string, et: string, xd: string, xt: string): number {
  try {
    const entry = new Date(`${ed}T${et.padStart(5,"0")}:00`);
    const exit  = new Date(`${xd}T${xt.padStart(5,"0")}:00`);
    return Math.round((exit.getTime() - entry.getTime()) / 60000);
  } catch { return 0; }
}

function calcHoldDays(ed: string, xd: string): number {
  try {
    return Math.round((new Date(xd).getTime() - new Date(ed).getTime()) / 86400000);
  } catch { return 0; }
}

function calcPnL(dir: "long"|"short", ep: number, xp: number, size: number, ef: number, xf: number): number {
  return (dir === "long" ? (xp-ep)*size : (ep-xp)*size) - ef - xf;
}

function compareTradeRowDateTime(a: TradeRow, b: TradeRow): number {
  const [ay, am, ad] = a.date.split("-").map(Number);
  const [by, bm, bd] = b.date.split("-").map(Number);
  const [ah = 0, amin = 0] = a.time.split(":").map(Number);
  const [bh = 0, bmin = 0] = b.time.split(":").map(Number);
  return new Date(ay, am - 1, ad, ah, amin).getTime() - new Date(by, bm - 1, bd, bh, bmin).getTime();
}

export interface MatchResult {
  trades:   Trade[];
  openRows: TradeRow[];
}

export function matchTrades(rows: TradeRow[], marketScores: Record<string, number>): MatchResult {
  const byId: Record<string, TradeRow[]> = {};
  for (const row of rows) {
    if (!byId[row.trade_id]) byId[row.trade_id] = [];
    byId[row.trade_id].push(row);
  }

  const trades:   Trade[]    = [];
  const openRows: TradeRow[] = [];

  for (const [trade_id, tradeRows] of Object.entries(byId)) {
    const entries = tradeRows.filter(r => r.type === "entry");
    const exits   = tradeRows.filter(r => r.type === "exit");
    if (!entries.length) continue;

    entries.sort(compareTradeRowDateTime);
    exits.sort(compareTradeRowDateTime);

    const entry = entries[0];

    if (!exits.length) { openRows.push(entry); continue; }

    const dir        = entry.dir       ?? "long";
    const strategy   = entry.strategy  ?? "";
    const trade_score= entry.trade_score ?? 0;
    const target_sl  = entry.target_sl  ?? 0;
    const riskPerUnit= Math.abs(entry.price - target_sl);

    const totalExitSize = exits.reduce((s, e) => s + e.size, 0);
    const isPartial     = parseFloat(totalExitSize.toFixed(6)) < parseFloat(entry.size.toFixed(6));

    // ── Generate one Trade record per exit so each appears on its own exit_date ──
    // This ensures daily P&L shows P&L on the day each partial exit was taken.
    // The first exit absorbs the entry fees; remaining exits share none.
    let remainingEntryFees = entry.fees;

    exits.forEach((ex, idx) => {
      const exitFee     = ex.fees;
      const entryFeeShare = idx === 0 ? remainingEntryFees : 0;

      const pnl        = calcPnL(dir, entry.price, ex.price, ex.size, entryFeeShare, exitFee);
      const r_multiple = riskPerUnit > 0
        ? parseFloat((pnl / (riskPerUnit * ex.size)).toFixed(2))
        : 0;
      const entryCost  = entry.price * ex.size;
      const pnl_pct    = entryCost > 0 ? (pnl / entryCost) * 100 : 0;

      // For multi-exit trades show exit number in trade_id e.g. T001#1, T001#2
      const display_id = exits.length > 1 ? `${trade_id}#${idx + 1}` : trade_id;

      trades.push({
        trade_id:        display_id,
        symbol:          entry.symbol,
        dir,
        strategy,
        trade_score,
        grade:           getGrade(trade_score),
        target_sl,
        account:         entry.account,
        entry_date:      entry.date,
        entry_time:      entry.time,
        entry_price:     entry.price,
        entry_size:      entry.size,
        entry_fees:      entry.fees,
        entry_note:      entry.note,
        entry_mistakes:  entry.mistakes,
        entry_file:      entry.filePath,
        exit_date:       ex.date,
        exit_time:       ex.time,
        exit_price:      ex.price,
        exit_fees:       exitFee,
        exit_note:       ex.note,
        exit_mistakes:   ex.mistakes,
        exit_file:       ex.filePath,
        filled_size:     ex.size,
        // is_partial = true if position is not fully closed yet at this exit
        // For the last exit: true if total fills < entry size (still open residual)
        // For intermediate exits: always true (more exits may follow)
        is_partial:      idx < exits.length - 1 ? true : isPartial,
        exit_count:      exits.length,
        pnl:             parseFloat(pnl.toFixed(2)),
        pnl_pct:         parseFloat(pnl_pct.toFixed(4)),
        r_multiple,
        hold_days:       calcHoldDays(entry.date, ex.date),
        hold_minutes:    calcHoldMinutes(entry.date, entry.time, ex.date, ex.time),
        is_winner:       pnl > 0,
        market_score:    marketScores[entry.date],
      });
    });

    if (isPartial) openRows.push({ ...entry, size: entry.size - totalExitSize });
  }

  trades.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  return { trades, openRows };
}
