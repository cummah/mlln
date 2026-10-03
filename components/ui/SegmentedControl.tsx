import React from 'react';

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  className?: string;
}

export function SegmentedControl({
  value,
  onChange,
  options,
  className = '',
}: SegmentedControlProps) {
  return (
    <div className={`inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-lg p-0.5 gap-0 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3.5 py-1.25 text-[13px] font-medium transition-all rounded border-none font-sans cursor-pointer ${
            value === option.value
              ? 'bg-[var(--teal)] text-[#040e18] font-semibold'
              : 'bg-transparent text-[var(--text-2)] hover:text-[var(--text)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
