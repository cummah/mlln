'use client';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

// Two native range inputs stacked on the same box only ever show the native
// track of whichever one paints last (the max/right thumb), so dragging the
// min/left thumb never visibly changed the fill. These explicit track/fill
// divs replace both native tracks (made transparent below) so the highlighted
// band always reflects both handles.
export function DualRangeSlider({ min, max, step = 1, minValue, maxValue, onMinChange, onMaxChange }: DualRangeSliderProps) {
  const minPct = ((minValue - min) / (max - min)) * 100;
  const maxPct = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className="dual-range" style={{ position: 'relative', height: '20px', width: '100%' }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: '4px',
        transform: 'translateY(-50%)', borderRadius: '2px',
        background: 'var(--border)', backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', height: '4px',
        transform: 'translateY(-50%)', borderRadius: '2px',
        left: `${minPct}%`, width: `${maxPct - minPct}%`,
        background: '#fff',
      }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minValue}
        onChange={(e) => onMinChange(Math.min(Number(e.target.value), maxValue))}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxValue}
        onChange={(e) => onMaxChange(Math.max(Number(e.target.value), minValue))}
      />
    </div>
  );
}
