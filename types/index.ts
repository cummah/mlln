export type Period = '1y' | '3y' | '5y';
export type Frequency = 'weekly' | 'monthly';
export type SignalStrength = 'strong_dip' | 'moderate_dip' | 'mild_dip' | 'mild_opportunity' | 'neutral' | 'overbought';
export type UserPlan = 'free' | 'pro' | 'quant' | null;

// Auth and subscriptions
export type UserTier = 0 | 1 | 2 | 3;
export type GatingSection = 'asset_page' | 'rank' | 'sectors' | 'watchlist' | 'weekly_signals' | 'monthly_signals';

export interface UserProfile {
  user_id: string;
  tier: UserTier;
  tradingview_enabled: boolean;
  billing_provider: string | null;
  billing_customer_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TierPermissions {
  section: GatingSection;
  tier: UserTier;
  can_view_latest_signal: boolean;
}

export interface Entitlement {
  tier: UserTier;
  assets: Set<string>; // ticker set for tier 1, empty for tier 0, ignored for tier 2/3
}

export interface User {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

export interface OHLCData {
  time: string; // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Signal {
  date: string; // 'YYYY-MM-DD'
  mult: number;
  skipped: boolean;
  buyAmount: number;
  exitDate?: string | null; // 'YYYY-MM-DD' when trade closed, null if open or not computed
  exitReturn?: number | null; // % return from entry to exit, null if open
  exitScore?: number | null; // exit score at the point of exit (0-9 range), null if open
  exitOpen?: boolean; // true if trade still open (no exit yet)
}

export interface AssetData {
  ticker: string;
  name: string;
  sector?: string;
  assetType?: string;
  price: number;
  change1d: number;
  changePercent1d: number;

  // Macro metrics (from asset_macro_metrics table)
  macroRegime?: string;
  convictionScore?: number;
  dcaScore?: number;
  sectorModifier?: number;
  fundamentalScore?: number | null;
  stalenessPenalty?: number | null;

  // Signals
  weeklySignal?: { strength: string; amount: number; totalBuys5y: number };
  monthlySignal?: { strength: string; amount: number; totalBuys5y: number };
  dailySignal?: { strength: string; amount: number; totalBuys5y: number };

  // Returns (DCA - reference)
  returns?: { return5y: number; return3y: number; return1y: number };

  // Macro returns
  macro_return_5y?: number;
  macro_return_3y?: number;
  macro_return_1y?: number;
  macro_invested_5y?: number;
  macro_invested_3y?: number;
  macro_invested_1y?: number;
  macro_buy_count_5y?: number;
  macro_buy_count_3y?: number;
  macro_buy_count_1y?: number;
  alpha_vs_standard_5y?: number;

  // Timestamps
  updatedAt?: string;
  computedAt?: string;
}

export interface CurrentSignal {
  amount: number;
  strength: SignalStrength;
  mult: number;
  reasoning: string;
}

export interface AssetPageData {
  asset: AssetData;
  ohlc: OHLCData[];
  signals: Signal[];
  currentSignal: CurrentSignal;
}

export interface User {
  id: string;
  email: string;
  plan: UserPlan;
}

export interface AppState {
  frequency: Frequency;
  baseAmount: number;
  selectedRange: Period;
  user: User | null;
}
