export type TradeType      = "entry" | "exit";
export type TradeDirection = "long" | "short";
export type TradeGrade     = "A" | "B" | "C" | "D";
export type MarketConditionLabel = "Bad" | "Poor" | "Neutral" | "Good" | "Excellent";
export type TradeStatusFilter = "open" | "closed" | "partial";
export type HoldBucketFilter = "same-day" | "2-5d" | "1-2w" | "2w+";

export interface TradeRow {
  trade_id:     string;
  symbol:       string;
  type:         TradeType;
  price:        number;
  size:         number;
  fees:         number;
  time:         string;
  account:      string;
  note:         string;
  mistakes:     string[];
  dir?:         TradeDirection;
  strategy?:    string;
  trade_score?: number;    // 0-55, from 'score' column in trade table → grade
  target_sl?:   number;
  date:         string;
  filePath:     string;
}

export interface Trade {
  trade_id:        string;
  symbol:          string;
  dir:             TradeDirection;
  strategy:        string;
  trade_score:     number;   // 0-55 setup rating
  grade:           TradeGrade;
  target_sl:       number;
  account:         string;
  entry_date:      string;
  entry_time:      string;
  entry_price:     number;
  entry_size:      number;
  entry_fees:      number;
  entry_note:      string;
  entry_mistakes:  string[];
  entry_file:      string;
  exit_date:       string;
  exit_time:       string;
  exit_price:      number;
  exit_fees:       number;
  exit_note:       string;
  exit_mistakes:   string[];
  exit_file:       string;
  filled_size:     number;
  is_partial:      boolean;
  exit_count:      number;
  pnl:             number;
  pnl_pct:         number;
  r_multiple:      number;
  hold_days:       number;
  hold_minutes:    number;
  is_winner:       boolean;
  market_score?:   number;   // 0-100, from frontmatter 'score' (market conditions)
}

export type AccountEventType = "initial" | "deposit" | "withdrawal";

export interface AccountEvent {
  account: string;
  date:    string;
  type:    AccountEventType;
  amount:  number;
  note:    string;
}

export interface TradeCache {
  version:        number;
  last_updated:   string;
  trades:         Trade[];
  open_rows:      TradeRow[];
  account_events: AccountEvent[];
  file_mtimes:    Record<string, number>;
}

export interface StreakInfo {
  last5:          { trade: Trade; is_winner: boolean }[];  // newest first
  current_streak: number;      // positive=wins, negative=losses
  longest_win:    number;
  longest_loss:   number;
  momentum:       "hot" | "cold" | "neutral" | "none";
}

export interface WeekdayStat {
  weekday: string;
  net_pnl: number;
  trade_count: number;
  win_rate: number;
}

export interface DailyStreakStats {
  current_green: number;
  current_red: number;
  longest_green: number;
  longest_red: number;
}

export interface SetupScoreBucketStat {
  label: string;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
  avg_r: number;
  avg_pct: number;
}

export interface MarketConditionStat {
  label: MarketConditionLabel;
  trade_count: number;
  win_rate: number;
  net_pnl: number;
  avg_r: number;
  avg_pct: number;
  expectancy_r: number;
}

export interface TradeStats {
  net_pnl:             number;
  trade_count:         number;   // unique trade openings
  exit_count:          number;    // total exit records
  win_count:           number;
  loss_count:          number;
  win_rate:            number;
  profit_factor:       number;
  avg_win:             number;
  avg_loss:            number;
  avg_win_pct:         number;
  avg_loss_pct:        number;
  median_win:          number;
  median_loss:         number;
  median_r:            number;
  expectancy_pnl:      number;
  expectancy_r:        number;
  avg_r_multiple:      number;
  avg_r_win:           number;
  avg_r_loss:          number;
  avg_win_loss_ratio:  number;   // avg win / avg loss
  gain_to_pain:        number;
  total_fees:          number;
  fees_pct_gross_profit: number;
  avg_fees_per_trade:  number;
  largest_win:         number;
  largest_win_trade?:  Trade;
  largest_loss:        number;
  largest_loss_trade?: Trade;
  day_win_rate:        number;
  overall_roi:         number;
  max_drawdown:        number;
  max_drawdown_pct:    number;
  current_balance:     number;
  streak:              StreakInfo;
  equity_curve:        { date: string; value: number }[];
  drawdown_curve:      { date: string; value: number }[];
  daily_pnl:           { date: string; pnl: number; count: number }[];
  weekly_pnl:          { week: string; pnl: number; count: number }[];
  monthly_pnl:         { month: string; pnl: number; count: number }[];
  weekday_stats:       WeekdayStat[];
  daily_streaks:       DailyStreakStats;
  pnl_by_slot:         { slot: string; pnl: number; winners: number; losers: number }[];
  duration_by_outcome: { bucket: string; winners: number; losers: number }[];
  avg_hold_win_minutes: number;
  avg_hold_loss_minutes: number;
  median_hold_win_minutes: number;
  median_hold_loss_minutes: number;
  pnl_by_strategy:     Record<string, StrategyStats>;
  pnl_by_grade:        Record<TradeGrade, GradeStats>;
  setup_score_buckets: SetupScoreBucketStat[];
  market_condition_stats: MarketConditionStat[];
  market_correlation:  { score: number; pnl: number; date: string; symbol: string }[];
}

export interface StrategyStats {
  strategy:      string;
  net_pnl:       number;
  trade_count:   number;
  win_rate:      number;
  profit_factor: number;
  avg_r:         number;
}

export interface GradeStats {
  grade:       TradeGrade;
  net_pnl:     number;
  trade_count: number;
  win_rate:    number;
  avg_r:       number;
}

export interface TradeFilters {
  date_from?: string;
  date_to?:   string;
  account?:   string;
  strategy?:  string;
  grade?:     TradeGrade;
  dir?:       TradeDirection;
  symbol?:    string;
  market_condition?: MarketConditionLabel;
  weekday?:   string;
  status?:    TradeStatusFilter;
  hold_bucket?: HoldBucketFilter;
}
