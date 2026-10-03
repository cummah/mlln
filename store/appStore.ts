'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Frequency, Period, User, UserPlan } from '@/types';

export type BacktestModel = 'enhanced' | 'macro';

interface AppStore {
  // Settings (persisted)
  frequency: Frequency;
  setFrequency: (frequency: Frequency) => void;
  baseAmount: number;
  setBaseAmount: (amount: number) => void;
  backtestModel: BacktestModel;
  setBacktestModel: (model: BacktestModel) => void;
  // Macro model only: independently toggleable components (PCA factor tilt, EWMA
  // volatility-conditioned dip sizing). Both on = the precomputed backtest_summary_macro baseline.
  macroFactorEnabled: boolean;
  setMacroFactorEnabled: (enabled: boolean) => void;
  macroVolEnabled: boolean;
  setMacroVolEnabled: (enabled: boolean) => void;
  macroMeanReversionEnabled: boolean;
  setMacroMeanReversionEnabled: (enabled: boolean) => void;

  // Asset page
  selectedRange: Period;
  setSelectedRange: (range: Period) => void;

  // Auth
  user: User | null;
  plan: UserPlan;
  setUser: (user: User | null) => void;
  setPlan: (plan: UserPlan) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      frequency: 'weekly',
      setFrequency: (frequency) => set({ frequency }),
      baseAmount: 100,
      setBaseAmount: (baseAmount) => set({ baseAmount }),
      backtestModel: 'enhanced',
      setBacktestModel: (backtestModel) => set({ backtestModel }),
      macroFactorEnabled: true,
      setMacroFactorEnabled: (macroFactorEnabled) => set({ macroFactorEnabled }),
      macroVolEnabled: true,
      setMacroVolEnabled: (macroVolEnabled) => set({ macroVolEnabled }),
      macroMeanReversionEnabled: true,
      setMacroMeanReversionEnabled: (macroMeanReversionEnabled) => set({ macroMeanReversionEnabled }),
      selectedRange: '1y',
      setSelectedRange: (selectedRange) => set({ selectedRange }),
      user: null,
      plan: null,
      setUser: (user) => set({ user }),
      setPlan: (plan) => set({ plan }),
    }),
    {
      name: 'app-store',
    }
  )
);
