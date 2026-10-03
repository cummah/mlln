import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  className?: string;
}

export function StatCard({ label, value, sublabel, className = '' }: StatCardProps) {
  return (
    <div
      className={`bg-[var(--surface)] rounded-[12px] p-4 border border-[var(--border)] ${className}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1.5">
        {label}
      </div>
      <div className="text-[20px] font-bold text-[var(--text)] mb-0.75 break-words">
        {value}
      </div>
      {sublabel && (
        <div className="text-[11px] text-[var(--text-2)] leading-relaxed">
          {sublabel}
        </div>
      )}
    </div>
  );
}
