import { Plugin, WorkspaceLeaf, ItemView, Notice } from "obsidian";
import { CacheManager } from "./cache";
import { calcStats, filterTrades, countUniqueTrades } from "./stats";
import { TradeFilters } from "./types";
import { renderDashboard } from "./dashboard";

const DASHBOARD_VIEW = "trading-journal-dashboard";
const SIDEBAR_VIEW   = "trading-journal-sidebar";

class DashboardView extends ItemView {
  private cache:        CacheManager;
  private filters:      TradeFilters = {};
  private unsubscribe:  (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, cache: CacheManager) {
    super(leaf);
    this.cache = cache;
  }

  getViewType()    { return DASHBOARD_VIEW; }
  getDisplayText() { return "Trading Dashboard"; }
  getIcon()        { return "bar-chart-2"; }

  async onOpen(): Promise<void> {
    // Always render when tab becomes visible
    this.render();
    // Register cache listener only once
    if (!this.unsubscribe) {
      const listener = () => this.render();
      this.cache.onUpdate(listener);
      this.unsubscribe = () => this.cache.offUpdate(listener);
    }
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.cssText = "padding:0;overflow-y:auto;height:100%;";

    const allTrades = this.cache.getTrades();
    const events    = this.cache.getAccountEvents();
    const filtered  = filterTrades(allTrades, this.filters);
    const stats     = calcStats(allTrades, events, this.filters);

    renderDashboard(container, stats, filtered, events, this.filters,
      (f) => { this.filters = f; this.render(); },
      (filePath) => this.openFile(filePath)
    );
  }

  private async openFile(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file as any);
  }
}

class SidebarView extends ItemView {
  private cache:       CacheManager;
  private unsubscribe: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, cache: CacheManager) {
    super(leaf);
    this.cache = cache;
  }

  getViewType()    { return SIDEBAR_VIEW; }
  getDisplayText() { return "Trading Summary"; }
  getIcon()        { return "trending-up"; }

  async onOpen(): Promise<void> {
    this.render();
    if (!this.unsubscribe) {
      const listener = () => this.render();
      this.cache.onUpdate(listener);
      this.unsubscribe = () => this.cache.offUpdate(listener);
    }
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.cssText = "padding:12px;min-height:100%;";

    const trades  = this.cache.getTrades();
    const events  = this.cache.getAccountEvents();
    const stats   = calcStats(trades, events, {});
    const f       = "var(--font-interface),var(--font-text),monospace";
    const streak  = stats.streak;

    const wrap = container.createEl("div", { attr: { style: `font-family:${f};` } });

    wrap.createEl("div", { text: "Trading Summary", attr: { style: "color:var(--text-normal);font-size:13px;font-weight:700;margin-bottom:10px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:8px;" } });

    const items = [
      { label:"Net P&L",       value:`$${stats.net_pnl.toFixed(2)}`,            color: stats.net_pnl>=0?"#4ade80":"#f87171" },
      { label:"Win Rate",      value:`${stats.win_rate}%`,                       color: stats.win_rate>=50?"#4ade80":"#f87171" },
      { label:"Profit Factor", value:String(stats.profit_factor),                color: stats.profit_factor>=1?"#4ade80":"#f87171" },
      { label:"Trades",        value:`${stats.trade_count} (${stats.win_count}W/${stats.loss_count}L)`, color:"var(--text-muted)" },
      { label:"Largest Win",   value:`$${stats.largest_win.toFixed(2)}`,         color:"#4ade80" },
      { label:"Largest Loss",  value:`-$${stats.largest_loss.toFixed(2)}`,       color:"#f87171" },
      { label:"Avg Win",       value:`$${stats.avg_win.toFixed(2)}`,             color:"#4ade80" },
      { label:"Avg Loss",      value:`$${stats.avg_loss.toFixed(2)}`,            color:"#f87171" },
      { label:"Avg R",         value:`${stats.avg_r_multiple}R`,                 color: stats.avg_r_multiple>=0?"#4ade80":"#f87171" },
      { label:"Max DD",        value:`${stats.max_drawdown_pct.toFixed(1)}%`,    color:"#f87171" },
      { label:"ROI",           value:`${stats.overall_roi}%`,                    color: stats.overall_roi>=0?"#4ade80":"#f87171" },
      { label:"Balance",       value:`$${stats.current_balance.toFixed(2)}`,     color:"#60a5fa" },
    ];

    items.forEach(item => {
      const row = wrap.createEl("div", { attr: { style:"display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--background-modifier-border);" } });
      row.createEl("span", { text:item.label, attr:{ style:"color:var(--text-muted);font-size:11px;" } });
      row.createEl("span", { text:item.value, attr:{ style:`color:${item.color};font-size:12px;font-weight:700;` } });
    });

    // Streak
    if (streak.last5.length) {
      wrap.createEl("div", { text:"Last 5 Trades", attr:{ style:"color:var(--text-muted);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:12px;margin-bottom:6px;" } });
      const streakRow = wrap.createEl("div", { attr:{ style:"display:flex;gap:6px;align-items:center;" } });
      streak.last5.forEach(w => {
        streakRow.createEl("div", { attr:{ style:`width:20px;height:20px;border-radius:50%;background:${w?"#4ade80":"#f87171"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;` }, text: w?"W":"L" });
      });
      const mLabel = streak.momentum==="hot"?"🔥 Hot":streak.momentum==="cold"?"❄️ Cold":"〰️ Mixed";
      streakRow.createEl("span", { text:mLabel, attr:{ style:`color:${streak.momentum==="hot"?"#facc15":streak.momentum==="cold"?"#60a5fa":"var(--text-muted)"};font-size:11px;margin-left:4px;font-weight:700;` } });
    }

    // Open positions
    const open = this.cache.getOpenRows();
    if (open.length) {
      wrap.createEl("div", { text:`Open Positions (${open.length})`, attr:{ style:"color:#facc15;font-size:11px;font-weight:700;margin-top:12px;margin-bottom:6px;" } });
      open.forEach(r => {
        const row = wrap.createEl("div", { attr:{ style:"display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--background-modifier-border);" } });
        row.createEl("span", { text:`${r.symbol} ${r.dir??""}`, attr:{ style:"color:var(--text-normal);font-size:11px;" } });
        row.createEl("span", { text:`@${r.price}`, attr:{ style:"color:var(--text-muted);font-size:11px;" } });
      });
    }

    wrap.createEl("div", { text:`↻ ${new Date(this.cache.getLastUpdated()).toLocaleTimeString()}`, attr:{ style:"color:var(--text-faint);font-size:10px;margin-top:10px;text-align:center;" } });
  }
}

export default class TradingJournalPlugin extends Plugin {
  private cache!: CacheManager;

  async onload(): Promise<void> {
    this.cache = new CacheManager(this);
    await this.cache.initialize();

    this.registerView(DASHBOARD_VIEW, leaf => new DashboardView(leaf, this.cache));
    this.registerView(SIDEBAR_VIEW,   leaf => new SidebarView(leaf, this.cache));

    this.addRibbonIcon("bar-chart-2", "Trading Dashboard", () => this.openDashboard());
    this.addCommand({ id:"open-trading-dashboard", name:"Open Trading Dashboard", callback:()=>this.openDashboard() });
    this.addCommand({ id:"open-trading-sidebar",   name:"Open Trading Sidebar",   callback:()=>this.openSidebar() });
    this.addCommand({
      id:"rebuild-trading-cache", name:"Rebuild Trading Cache",
      callback: async () => { await this.cache.rebuild(msg => console.log("Trading Journal:", msg)); }
    });

    this.addCommand({
      id:"debug-trading-data", name:"Trading Journal: Debug — dump data to console",
      callback: () => {
        const trades = this.cache.getTrades();
        const open   = this.cache.getOpenRows();
        console.group("=== Trading Journal Debug ===");
        console.log(`Total unique trades: ${new Set(trades.map((t:any)=>t.trade_id.replace(/#\\d+$/,""))).size} (${trades.length} exit records)`);
        console.log(`Total open rows: ${open.length}`);
        console.log("\n--- All trades (entry_date, exit_date, symbol, pnl, market_score) ---");
        trades.forEach(t => console.log(`${t.entry_date} → ${t.exit_date} | ${t.symbol} | P&L: $${t.pnl} | market_score: ${t.market_score ?? "MISSING"} | exit_count: ${t.exit_count} | filled: ${t.filled_size}/${t.entry_size}`));
        console.log("\n--- Open rows ---");
        open.forEach(r => console.log(`${r.date} | ${r.symbol} | size: ${r.size} | type: ${r.type}`));

        // Group by exit_date to show what calendar would show
        const byDate: Record<string, any[]> = {};
        trades.forEach(t => {
          if (!byDate[t.exit_date]) byDate[t.exit_date] = [];
          byDate[t.exit_date].push(t);
        });
        console.log("\n--- Trades grouped by exit_date (what calendar shows) ---");
        Object.entries(byDate).sort().forEach(([d, ts]) => {
          const total = ts.reduce((s:number, t:any) => s + t.pnl, 0);
          console.log(`${d}: ${ts.length} trades, total P&L: $${total.toFixed(2)}`);
          ts.forEach((t:any) => console.log(`  └ ${t.symbol} ${t.dir} | entry: ${t.entry_date} | P&L: $${t.pnl} | exits: ${t.exit_count} | filled: ${t.filled_size}/${t.entry_size}`));
        });
        console.groupEnd();
        // Also dump market scores directly from metadataCache
        const vault = this.app.vault;
        const mc    = this.app.metadataCache;
        const files = vault.getFiles().filter((f: any) => f.path.startsWith("Master/Journal") && f.extension === "md");
        console.group("=== Market Score Frontmatter Debug ===");
        console.log(`Scanning ${files.length} journal files for 'score' frontmatter...`);
        let found = 0, missing = 0;
        files.forEach((f: any) => {
          const fm = mc.getFileCache(f)?.frontmatter;
          const score = fm?.["score"] ?? fm?.["market_score"];
          if (score !== undefined && score !== null) {
            console.log(`  FOUND: ${f.basename} → score = ${JSON.stringify(score)} (type: ${typeof score})`);
            found++;
          } else {
            console.log(`  MISSING: ${f.basename} → frontmatter keys: ${fm ? Object.keys(fm).join(", ") : "NO FRONTMATTER"}`);
            missing++;
          }
        });
        console.log(`\nSummary: ${found} with score, ${missing} without`);
        console.groupEnd();
        new Notice("Debug data dumped to console (Ctrl+Shift+I to open DevTools)");
      }
    });

    this.app.workspace.onLayoutReady(() => this.openSidebar());
  }

  async onunload(): Promise<void> {}

  private async openDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW);
    if (existing.length) { this.app.workspace.revealLeaf(existing[0]); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: DASHBOARD_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private async openSidebar(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(SIDEBAR_VIEW).length) return;
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) await leaf.setViewState({ type: SIDEBAR_VIEW, active: true });
  }
}
