import { Plugin, TAbstractFile, TFile, requestUrl } from "obsidian";

const JOURNAL_FOLDER = "Master/Journal";
const MARKET_DATA_FILE = "Market Data.md";
const JOURNAL_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

const MARKET_MONITOR_HEADING = /^##\s+Market Monitor\s*$/i;
const ADV_DEC_HEADING = /^##\s+Advance\/Decline\s*$/i;
const HIGH_LOW_HEADING = /^##\s+52w Highs\/Lows\s*$/i;
const PERFORMANCE_TRACKS_HEADING = /^##\s+Performance Tracks\s*$/i;

type HeadingPattern = RegExp;
type SignalString = "true" | "false";

interface ParsedTable {
  headers: string[];
  rows: string[][];
  blockStart: number;
  blockEnd: number;
  blockText: string;
}

interface MarketDataDocument {
  marketMonitor: ParsedTable | null;
  highLows: ParsedTable | null;
  advanceDecline: ParsedTable | null;
  performanceTracks: ParsedTable | null;
  content: string;
  file: TFile;
}

export interface MarketMonitorTableRow {
  dateIso: string;
  dateDisplay: string;
  up4: number;
  down4: number;
  ratio5: number | null;
  ratio10: number | null;
  upQuarter25: number;
  downQuarter25: number;
  upMonth25: number;
  downMonth25: number;
  upMonth50: number;
  downMonth50: number;
  up34: number;
  down34: number;
  t2108: number | null;
}

export interface HighLowRow {
  dateIso: string;
  dateDisplay: string;
  high52: number;
  low52: number;
  net: number;
  signal: SignalString;
}

export interface AdvanceDeclineRow {
  dateIso: string;
  dateDisplay: string;
  advance: number;
  decline: number;
  net: number;
  mcclellan: number | null;
  summation: number | null;
}

export interface PerformanceTrackRow {
  dateIso: string;
  dateDisplay: string;
  up8_5d: number;
  down8_5d: number;
  up20_5d: number;
  down20_5d: number;
  above21sma: number;
  above200sma: number;
}

export interface MarketMonitorDashboardData {
  monitorRows: MarketMonitorTableRow[];
  highLowRows: HighLowRow[];
  advanceDeclineRows: AdvanceDeclineRow[];
  performanceTrackRows: PerformanceTrackRow[];
}

interface QqqeSignals {
  qqqe_ema1020: boolean;
  qqqe_ema5: boolean;
  qqqe_wema1020: boolean;
}

export interface MarketMonitorSyncResult {
  updatedMarketData: boolean;
  updatedFrontmatter: boolean;
  skipped?: string;
}

function parseTableRow(line: string): string[] {
  return line.split("|").slice(1, -1).map(cell => cell.trim());
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}

function parseNum(value: string): number {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNum(value: string): number | null {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDdMmYyyyToIso(value: string): string | null {
  const m = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function formatIsoToDisplay(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function extractJournalDate(file: TFile): string | null {
  return file.basename.match(JOURNAL_DATE_RE)?.[1] ?? null;
}

function isWeekday(dateIso: string): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day >= 1 && day <= 5;
}

function findTableByHeading(content: string, headingPattern: HeadingPattern): ParsedTable | null {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex(line => headingPattern.test(line.trim()));
  if (headingIndex === -1) return null;

  let headerIndex = -1;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      headerIndex = i;
      break;
    }
    if (lines[i].trim().startsWith("## ")) break;
  }
  if (headerIndex === -1 || headerIndex + 1 >= lines.length || !isTableLine(lines[headerIndex + 1])) return null;

  let endIndex = headerIndex + 2;
  while (endIndex < lines.length && isTableLine(lines[endIndex])) endIndex++;
  endIndex -= 1;

  const headers = parseTableRow(lines[headerIndex]);
  const rows = lines.slice(headerIndex + 2, endIndex + 1).map(parseTableRow);

  return {
    headers,
    rows,
    blockStart: headerIndex,
    blockEnd: endIndex,
    blockText: lines.slice(headerIndex, endIndex + 1).join("\n"),
  };
}

function formatMarkdownTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, idx) => {
    const rowWidths = rows.map(row => (row[idx] ?? "").length);
    return Math.max(header.length, ...rowWidths, 3);
  });

  const formatRow = (cells: string[]): string => `| ${cells.map((cell, idx) => (cell ?? "").padEnd(widths[idx])).join(" | ")} |`;
  const separator = `| ${widths.map(w => "-".repeat(w)).join(" | ")} |`;

  return [formatRow(headers), separator, ...rows.map(formatRow)].join("\n");
}

function computeRollingRatio(rows: string[][], upIdx: number, downIdx: number, lookback: number): string {
  if (rows.length < lookback) return "-";
  const sample = rows.slice(0, lookback);
  const totalUp = sample.reduce((sum, row) => sum + parseNum(row[upIdx] ?? "0"), 0);
  const totalDown = sample.reduce((sum, row) => sum + parseNum(row[downIdx] ?? "0"), 0);
  if (totalDown <= 0) return "-";
  return formatRatio(totalUp / totalDown);
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates.map(normalizeHeader)) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function sortAscByDate<T extends { dateIso: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

function sortDescByDate<T extends { dateIso: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < period) return out;

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

function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}

function computeHighLowSignals(rows: HighLowRow[]): HighLowRow[] {
  const asc = sortAscByDate(rows);
  let positiveStreak = 0;
  let nonPositiveStreak = 0;
  let signal: SignalString = "false";

  const withSignals = asc.map(row => {
    if (row.net > 0) {
      positiveStreak += 1;
      nonPositiveStreak = 0;
      if (positiveStreak >= 3) signal = "true";
    } else {
      nonPositiveStreak += 1;
      positiveStreak = 0;
      if (nonPositiveStreak >= 3) signal = "false";
    }
    return { ...row, signal };
  });

  return sortDescByDate(withSignals);
}

function buildMarketMonitorRows(headers: string[], rows: string[][]): MarketMonitorTableRow[] {
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

  if ([idxDate, idxUp4, idxDown4, idxRatio5, idxRatio10, idxUpQuarter25, idxDownQuarter25, idxUpMonth25, idxDownMonth25, idxUpMonth50, idxDownMonth50, idxUp34, idxDown34].some(idx => idx === -1)) {
    return [];
  }

  return rows
    .map(row => {
      const dateIso = parseDdMmYyyyToIso(row[idxDate] ?? "");
      if (!dateIso) return null;
      return {
        dateIso,
        dateDisplay: row[idxDate] ?? formatIsoToDisplay(dateIso),
        up4: parseNum(row[idxUp4] ?? "0"),
        down4: parseNum(row[idxDown4] ?? "0"),
        ratio5: parseNullableNum(row[idxRatio5] ?? ""),
        ratio10: parseNullableNum(row[idxRatio10] ?? ""),
        upQuarter25: parseNum(row[idxUpQuarter25] ?? "0"),
        downQuarter25: parseNum(row[idxDownQuarter25] ?? "0"),
        upMonth25: parseNum(row[idxUpMonth25] ?? "0"),
        downMonth25: parseNum(row[idxDownMonth25] ?? "0"),
        upMonth50: parseNum(row[idxUpMonth50] ?? "0"),
        downMonth50: parseNum(row[idxDownMonth50] ?? "0"),
        up34: parseNum(row[idxUp34] ?? "0"),
        down34: parseNum(row[idxDown34] ?? "0"),
        t2108: idxT2108 === -1 ? null : parseNullableNum(row[idxT2108] ?? ""),
      };
    })
    .filter((row): row is MarketMonitorTableRow => row !== null);
}

function buildHighLowRows(headers: string[], rows: string[][]): HighLowRow[] {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxHigh = findColumnIndex(headers, ["52w high", "52 week high", "52whigh"]);
  const idxLow = findColumnIndex(headers, ["52w low", "52 week low", "52wlow"]);
  if ([idxDate, idxHigh, idxLow].some(idx => idx === -1)) return [];

  const parsed = rows
    .map(row => {
      const dateIso = parseDdMmYyyyToIso(row[idxDate] ?? "");
      if (!dateIso) return null;
      const high52 = parseNum(row[idxHigh] ?? "0");
      const low52 = parseNum(row[idxLow] ?? "0");
      return {
        dateIso,
        dateDisplay: row[idxDate] ?? formatIsoToDisplay(dateIso),
        high52,
        low52,
        net: high52 - low52,
        signal: "false" as SignalString,
      };
    })
    .filter((row): row is HighLowRow => row !== null);

  return computeHighLowSignals(parsed);
}

function buildPerformanceTrackRows(headers: string[], rows: string[][]): PerformanceTrackRow[] {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxUp8 = findColumnIndex(headers, ["8%+ Up 5d"]);
  const idxDown8 = findColumnIndex(headers, ["8%+ Down 5d"]);
  const idxUp20 = findColumnIndex(headers, ["20%+ Up 5d"]);
  const idxDown20 = findColumnIndex(headers, ["20%+ Down 5d"]);
  const idxAbove21 = findColumnIndex(headers, ["%Above 21SMA", "% Above 21SMA"]);
  const idxAbove200 = findColumnIndex(headers, ["%Above 200SMA", "% Above 200SMA"]);
  if ([idxDate, idxUp8, idxDown8, idxUp20, idxDown20, idxAbove21, idxAbove200].some(idx => idx === -1)) return [];

  return rows
    .map(row => {
      const dateIso = parseDdMmYyyyToIso(row[idxDate] ?? "");
      if (!dateIso) return null;
      return {
        dateIso,
        dateDisplay: row[idxDate] ?? formatIsoToDisplay(dateIso),
        up8_5d: parseNum(row[idxUp8] ?? "0"),
        down8_5d: parseNum(row[idxDown8] ?? "0"),
        up20_5d: parseNum(row[idxUp20] ?? "0"),
        down20_5d: parseNum(row[idxDown20] ?? "0"),
        above21sma: parseNum(row[idxAbove21] ?? "0"),
        above200sma: parseNum(row[idxAbove200] ?? "0"),
      };
    })
    .filter((row): row is PerformanceTrackRow => row !== null);
}

function buildAdvanceDeclineRows(headers: string[], rows: string[][]): AdvanceDeclineRow[] {
  const idxDate = findColumnIndex(headers, ["Date"]);
  const idxAdvance = findColumnIndex(headers, ["Advance", "Advances"]);
  const idxDecline = findColumnIndex(headers, ["Decline", "Declines"]);
  if ([idxDate, idxAdvance, idxDecline].some(idx => idx === -1)) return [];

  const parsed = rows
    .map(row => {
      const dateIso = parseDdMmYyyyToIso(row[idxDate] ?? "");
      if (!dateIso) return null;
      const advance = parseNum(row[idxAdvance] ?? "0");
      const decline = parseNum(row[idxDecline] ?? "0");
      return {
        dateIso,
        dateDisplay: row[idxDate] ?? formatIsoToDisplay(dateIso),
        advance,
        decline,
        net: advance - decline,
        mcclellan: null as number | null,
        summation: null as number | null,
      };
    })
    .filter((row): row is AdvanceDeclineRow => row !== null);

  const asc = sortAscByDate(parsed);
  const nets = asc.map(row => row.net);
  const ema19 = emaSeries(nets, 19);
  const ema39 = emaSeries(nets, 39);

  let runningSummation: number | null = null;
  const withIndicators = asc.map((row, idx) => {
    const fast = ema19[idx];
    const slow = ema39[idx];
    const mcclellan = fast !== null && slow !== null ? fast - slow : null;
    if (mcclellan !== null) {
      runningSummation = runningSummation === null ? mcclellan : runningSummation + mcclellan;
    }
    return {
      ...row,
      mcclellan,
      summation: runningSummation,
    };
  });

  return sortDescByDate(withIndicators);
}

async function fetchCloses(symbol: string, interval: "1d" | "1wk", period1: number, period2: number): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  const res = await requestUrl({
    url,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    },
  });

  const payload = res.json;
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) throw new Error(`Yahoo Finance returned no closes for ${symbol} (${interval})`);
  return closes.filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value));
}

async function fetchQqqeSignalsForDate(noteDateIso: string): Promise<QqqeSignals> {
  const [y, m, d] = noteDateIso.split("-").map(Number);
  const period2 = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  const dailyPeriod1 = period2 - 180 * 24 * 60 * 60;
  const weeklyPeriod1 = period2 - 900 * 24 * 60 * 60;

  const [dailyCloses, weeklyCloses] = await Promise.all([
    fetchCloses("QQQE", "1d", dailyPeriod1, period2),
    fetchCloses("QQQE", "1wk", weeklyPeriod1, period2),
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
    qqqe_wema1020: Boolean(weeklyEma10 !== null && weeklyEma20 !== null && weeklyClose > weeklyEma10 && weeklyClose > weeklyEma20 && weeklyEma10 > weeklyEma20),
  };
}

export class MarketMonitorService {
  constructor(private plugin: Plugin) {}

  async syncForCreatedFile(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return;
    if (!this.isEligibleJournalFile(file)) return;

    try {
      await this.syncNote(file);
    } catch (e) {
      console.error("Trading Journal: market monitor auto-sync failed", e);
    }
  }

  async syncActiveOrTodayNote(): Promise<MarketMonitorSyncResult> {
    const active = this.plugin.app.workspace.getActiveFile();
    if (active instanceof TFile && this.isEligibleJournalFile(active)) {
      return this.syncNote(active);
    }

    const today = todayIso();
    const fallback = this.plugin.app.vault.getFiles().find(file => {
      const dateIso = extractJournalDate(file);
      return this.isEligibleJournalFile(file) && dateIso === today;
    });

    if (!fallback) {
      return { updatedMarketData: await this.updateMarketDataOnly(), updatedFrontmatter: false, skipped: "No active or today's weekday daily note found." };
    }

    return this.syncNote(fallback);
  }

  async getDashboardData(): Promise<MarketMonitorDashboardData | null> {
    const marketData = await this.updateMarketDataTable();
    if (!marketData) return null;
    return {
      monitorRows: marketData.monitorRows,
      highLowRows: marketData.highLowRows,
      advanceDeclineRows: marketData.advanceDeclineRows,
      performanceTrackRows: marketData.performanceTrackRows,
    };
  }

  private isEligibleJournalFile(file: TFile): boolean {
    if (file.extension !== "md" || !file.path.startsWith(JOURNAL_FOLDER)) return false;
    const dateIso = extractJournalDate(file);
    if (!dateIso) return false;
    if (dateIso < todayIso()) return false;
    return isWeekday(dateIso);
  }

  private async syncNote(file: TFile): Promise<MarketMonitorSyncResult> {
    const noteDate = extractJournalDate(file);
    if (!noteDate) return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Daily note date not found in filename." };
    if (noteDate < todayIso()) return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Only today's and future notes are updated." };
    if (!isWeekday(noteDate)) return { updatedMarketData: false, updatedFrontmatter: false, skipped: "Weekend note skipped." };

    const marketData = await this.updateMarketDataTable();
    if (!marketData) return { updatedMarketData: false, updatedFrontmatter: false, skipped: `Could not read ${MARKET_DATA_FILE}.` };

    const previousMonitorRow = marketData.monitorRows.find(row => row.dateIso < noteDate);
    if (!previousMonitorRow) {
      return { updatedMarketData: marketData.updated, updatedFrontmatter: false, skipped: `No market monitor row found before ${noteDate}.` };
    }

    const previousHighLowRow = marketData.highLowRows.find(row => row.dateIso < noteDate);

    let qqqeSignals: Partial<QqqeSignals> = {};
    try {
      qqqeSignals = await fetchQqqeSignalsForDate(noteDate);
    } catch (e) {
      console.error("Trading Journal: failed to fetch QQQE signals", e);
    }

    await this.plugin.app.fileManager.processFrontMatter(file, frontmatter => {
      frontmatter["4up_down"] = previousMonitorRow.up4 > previousMonitorRow.down4 ? "true" : "false";
      frontmatter["5d_ratio"] = previousMonitorRow.ratio5 !== null && previousMonitorRow.ratio5 >= 1 ? "true" : "false";
      frontmatter["high_lows"] = previousHighLowRow?.signal ?? "false";

      if (qqqeSignals.qqqe_ema1020 !== undefined) frontmatter["qqqe_ema1020"] = qqqeSignals.qqqe_ema1020 ? "true" : "false";
      if (qqqeSignals.qqqe_ema5 !== undefined) frontmatter["qqqe_ema5"] = qqqeSignals.qqqe_ema5 ? "true" : "false";
      if (qqqeSignals.qqqe_wema1020 !== undefined) frontmatter["qqqe_wema1020"] = qqqeSignals.qqqe_wema1020 ? "true" : "false";
    });

    return { updatedMarketData: marketData.updated, updatedFrontmatter: true };
  }

  private async updateMarketDataOnly(): Promise<boolean> {
    const result = await this.updateMarketDataTable();
    return result?.updated ?? false;
  }

  private async readMarketDataDocument(): Promise<MarketDataDocument | null> {
    const file = this.plugin.app.vault.getAbstractFileByPath(MARKET_DATA_FILE);
    if (!(file instanceof TFile)) return null;
    const content = await this.plugin.app.vault.cachedRead(file);
    return {
      file,
      content,
      marketMonitor: findTableByHeading(content, MARKET_MONITOR_HEADING),
      highLows: findTableByHeading(content, HIGH_LOW_HEADING),
      advanceDecline: findTableByHeading(content, ADV_DEC_HEADING),
      performanceTracks: findTableByHeading(content, PERFORMANCE_TRACKS_HEADING),
    };
  }

  private async updateMarketDataTable(): Promise<{
    updated: boolean;
    monitorRows: MarketMonitorTableRow[];
    highLowRows: HighLowRow[];
    advanceDeclineRows: AdvanceDeclineRow[];
    performanceTrackRows: PerformanceTrackRow[];
  } | null> {
    const doc = await this.readMarketDataDocument();
    if (!doc || !doc.marketMonitor) return null;

    const headers = doc.marketMonitor.headers;
    const idxUp = findColumnIndex(headers, ["4%+ Up Today"]);
    const idxDown = findColumnIndex(headers, ["4%+ Down today"]);
    const idxRatio5 = findColumnIndex(headers, ["5 day ratio"]);
    const idxRatio10 = findColumnIndex(headers, ["10 day ratio"]);
    if ([idxUp, idxDown, idxRatio5, idxRatio10].some(idx => idx === -1)) return null;

    const rows = doc.marketMonitor.rows.map(row => [...row]);
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
      await this.plugin.app.vault.modify(doc.file, content);
      updated = true;
    }

    const finalMarketTable = updated ? findTableByHeading(content, MARKET_MONITOR_HEADING) : { ...doc.marketMonitor, rows, blockText: newTable };
    const finalHighLows = findTableByHeading(content, HIGH_LOW_HEADING);
    const finalAdvanceDecline = findTableByHeading(content, ADV_DEC_HEADING);
    const finalPerformanceTracks = findTableByHeading(content, PERFORMANCE_TRACKS_HEADING);

    return {
      updated,
      monitorRows: finalMarketTable ? buildMarketMonitorRows(finalMarketTable.headers, finalMarketTable.rows) : [],
      highLowRows: finalHighLows ? buildHighLowRows(finalHighLows.headers, finalHighLows.rows) : [],
      advanceDeclineRows: finalAdvanceDecline ? buildAdvanceDeclineRows(finalAdvanceDecline.headers, finalAdvanceDecline.rows) : [],
      performanceTrackRows: finalPerformanceTracks ? buildPerformanceTrackRows(finalPerformanceTracks.headers, finalPerformanceTracks.rows) : [],
    };
  }
}

export const MarketMonitorMath = {
  average,
  sortAscByDate,
  sortDescByDate,
};
