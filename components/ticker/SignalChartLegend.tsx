export function SignalChartLegend() {
  const items = [
    {
      color: '#0F6E56',
      label: 'Large buy — strong dip',
    },
    {
      color: '#1D9E75',
      label: 'Medium buy — moderate signal',
    },
    {
      color: '#5DCAA5',
      label: 'Small buy — base amount',
    },
    {
      color: '#9FE1CB',
      label: 'Skipped — unfavourable conditions',
    },
  ];

  return (
    <div className="flex flex-wrap gap-6 text-xs text-[var(--text-secondary)] mt-5 px-0">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 whitespace-nowrap">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
