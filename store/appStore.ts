'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Frequency, Period, User, UserPlan } from '@/types';

interface AppStore {
  // Settings (persisted)
  frequency: Frequency;
  setFrequency: (frequency: Frequency) => void;
  baseAmount: number;
  setBaseAmount: (amount: number) => void;

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
