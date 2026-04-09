import { Plugin, TFile, TAbstractFile } from "obsidian";
import { TradeCache, Trade, TradeRow, AccountEvent } from "./types";
import { scanVaultForTrades, extractMarketScores } from "./parser";
import { matchTrades } from "./matcher";

const CACHE_FILE       = ".trading-journal-cache.json";
const CACHE_VERSION    = 2;
const DEBOUNCE_MS      = 2000;
const MARKET_DATA_FILE = "Market Data.md";

function emptyCache(): TradeCache {
  return {
    version:        CACHE_VERSION,
    last_updated:   new Date().toISOString(),
    trades:         [],
    open_rows:      [],
    account_events: [],
    file_mtimes:    {},
  };
}

export class CacheManager {
  private plugin:        Plugin;
  private cache:         TradeCache;
  private debounceTimer: number | null = null;
  private isBuilding     = false;
  private isReady        = false;
  private listeners:     (() => void)[] = [];

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.cache  = emptyCache();
  }

  async initialize(): Promise<void> {
    await this.buildCache(true);   // always full build on startup for reliability
    this.registerFileWatcher();
    this.isReady = true;
  }

  onUpdate(listener: () => void): void {
    this.listeners.push(listener);
  }

  offUpdate(listener: () => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => fn());
  }

  getTrades():        Trade[]       { return this.cache.trades; }
  getOpenRows():      TradeRow[]    { return this.cache.open_rows; }
  getAccountEvents(): AccountEvent[]{ return this.cache.account_events; }
  getLastUpdated():   string        { return this.cache.last_updated; }
  getIsReady():       boolean       { return this.isReady; }

  async rebuild(onProgress?: (msg: string) => void): Promise<void> {
    await this.buildCache(true, onProgress);
  }

  private async saveCache(): Promise<void> {
    try {
      this.cache.last_updated = new Date().toISOString();
      await this.plugin.app.vault.adapter.write(
        CACHE_FILE,
        JSON.stringify(this.cache, null, 2)
      );
    } catch (e) {
      console.error("Trading Journal: failed to save cache", e);
    }
  }

  private async buildCache(
    full = false,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    if (this.isBuilding) return;
    this.isBuilding = true;

    try {
      const vault         = this.plugin.app.vault;
      const metadataCache = this.plugin.app.metadataCache;

      onProgress?.("Scanning vault...");

      const { rows, accountEvents, newMtimes } =
        await scanVaultForTrades(vault, {}, (cur, total) => {
          onProgress?.(`Scanning ${cur}/${total} files...`);
        });

      onProgress?.("Matching trades...");

      const marketScores = extractMarketScores(vault, metadataCache);
      const { trades, openRows } = matchTrades(rows, marketScores);

      this.cache = {
        version:        CACHE_VERSION,
        last_updated:   new Date().toISOString(),
        trades,
        open_rows:      openRows,
        account_events: accountEvents,
        file_mtimes:    newMtimes,
      };

      await this.saveCache();
      onProgress?.(`Done — ${trades.length} trades loaded.`);
      this.notifyListeners();
    } catch (e) {
      console.error("Trading Journal: cache build failed", e);
    } finally {
      this.isBuilding = false;
    }
  }

  private registerFileWatcher(): void {
    const { vault } = this.plugin.app;

    const trigger = (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      const isTradeFile = file.path.startsWith("Master/Journal") || file.path === "Accounts.md";
      const isMarketData = file.path === MARKET_DATA_FILE;
      if (!isTradeFile && !isMarketData) return;

      if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
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
}
