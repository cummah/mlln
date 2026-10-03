import React from 'react';

interface PillProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'blue' | 'amber' | 'red' | 'teal';
  className?: string;
}

const variants = {
  default: 'bg-[var(--surface2)] text-[var(--text-2)] border border-[var(--border)]',
  green: 'bg-[var(--green-dim)] text-[var(--green)] border border-[rgba(40,217,126,0.2)]',
  blue: 'bg-[var(--blue-fill)] text-[var(--blue-text)]',
  amber: 'bg-[rgba(240,161,40,0.1)] text-[var(--amber)] border border-[rgba(240,161,40,0.2)]',
  red: 'bg-[var(--red-dim)] text-[var(--red)] border border-[rgba(240,92,110,0.2)]',
  teal: 'bg-[var(--teal-dim)] text-[var(--teal)] border border-[var(--teal-mid)]',
};

export function Pill({ children, variant = 'default', className = '' }: PillProps) {
  return (
    <span
      className={`inline-block rounded-full px-2.25 py-0.75 text-[11px] font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
