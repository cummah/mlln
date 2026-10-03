export type Period = '1y' | '3y' | '5y';
export type Frequency = 'weekly' | 'monthly';

export interface BacktestData {
  stdReturn1y: number;
  enhReturn1y: number;
  stdInvested1y: number;
  enhInvested1y: number;
  stdPurchases1y: number;
  enhPurchases1y: number;

  stdReturn3y: number;
  enhReturn3y: number;
  stdInvested3y: number;
  enhInvested3y: number;
  stdPurchases3y: number;
  enhPurchases3y: number;

  stdReturn5y: number;
  enhReturn5y: number;
  stdInvested5y: number;
  enhInvested5y: number;
  stdPurchases5y: number;
  enhPurchases5y: number;

  alpha1y: number;
  alpha3y: number;
  alpha5y: number;
}

