'use client'

interface RSIDialProps {
  rsi: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function RSIDial({ rsi, size = 'md', showLabel = true }: RSIDialProps) {
  // Clamp RSI between 0 and 100
  const normalizedRsi = Math.max(0, Math.min(100, rsi))

  // Calculate angle (0-180 degrees for half circle, 0 = left, 90 = bottom, 180 = right)
  const angle = (normalizedRsi / 100) * 180
  const angleRad = (angle * Math.PI) / 180

  // Determine color based on RSI value
  let color = '#60a5fa' // blue for cold (0-30)
  if (normalizedRsi > 30 && normalizedRsi <= 50) {
    // Green zone (30-50)
    const ratio = (normalizedRsi - 30) / 20
    const green = Math.round(165 + (50 - 165) * ratio)
    const blue = Math.round(165 + (39 - 165) * ratio)
    color = `rgb(34, ${green}, ${blue})`
  } else if (normalizedRsi > 50 && normalizedRsi <= 65) {
    // Yellow/neutral zone (50-65)
    const ratio = (normalizedRsi - 50) / 15
    color = `rgb(${Math.round(34 + (234 - 34) * ratio)}, ${Math.round(197 + (179 - 197) * ratio)}, 39)`
  } else if (normalizedRsi > 65) {
    // Red zone (65-100)
    const ratio = (normalizedRsi - 65) / 35
    const red = 239
    const green = Math.round(68 - 68 * ratio)
    color = `rgb(${red}, ${green}, 68)`
  } else if (normalizedRsi < 30) {
    // Deep blue/cyan for very cold
    const ratio = normalizedRsi / 30
    color = `rgb(${Math.round(96 + (34 - 96) * ratio)}, ${Math.round(165 + (197 - 165) * ratio)}, ${Math.round(165 + (250 - 165) * ratio)})`
  }

  // Size mappings
  const sizeMap = {
    sm: { containerSize: 60, dialWidth: 4, fontSize: 10 },
    md: { containerSize: 80, dialWidth: 5, fontSize: 12 },
    lg: { containerSize: 100, dialWidth: 6, fontSize: 14 },
  }

  const { containerSize, dialWidth, fontSize } = sizeMap[size]
  const radius = containerSize / 2 - dialWidth

  // Calculate needle endpoint (rounded to prevent hydration mismatch)
  const needleX = Math.round((containerSize / 2 + radius * Math.cos(angleRad - Math.PI / 2)) * 100) / 100
  const needleY = Math.round((containerSize / 2 + radius * Math.sin(angleRad - Math.PI / 2)) * 100) / 100

  // Background arc segments for visual scale
  const segments = [
    { start: 0, end: 35, color: '#22a55f', label: 'Buy Zone' },
    { start: 35, end: 65, color: '#eab308', label: 'Neutral' },
    { start: 65, end: 100, color: '#ef4444', label: 'Overbought' },
  ]

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={containerSize} height={containerSize / 2 + 8} viewBox={`0 0 ${containerSize} ${containerSize / 2 + 8}`}>
        {/* Background segments */}
        {segments.map((seg) => {
          const startAngle = (seg.start / 100) * 180
          const endAngle = (seg.end / 100) * 180
          const startRad = (startAngle * Math.PI) / 180
          const endRad = (endAngle * Math.PI) / 180

          const x1 = Math.round((containerSize / 2 + radius * Math.cos(startRad - Math.PI / 2)) * 100) / 100
          const y1 = Math.round((containerSize / 2 + radius * Math.sin(startRad - Math.PI / 2)) * 100) / 100
          const x2 = Math.round((containerSize / 2 + radius * Math.cos(endRad - Math.PI / 2)) * 100) / 100
          const y2 = Math.round((containerSize / 2 + radius * Math.sin(endRad - Math.PI / 2)) * 100) / 100

          const largeArc = endAngle - startAngle > 180 ? 1 : 0

          return (
            <path
              key={`segment-${seg.start}`}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
              stroke={seg.color}
              strokeWidth={dialWidth}
              fill="none"
              opacity={0.3}
            />
          )
        })}

        {/* Active arc */}
        {normalizedRsi > 0 && (
          <>
            <defs>
              <linearGradient id="rsiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22a55f" />
                <stop offset="35%" stopColor="#22a55f" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="65%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Filled arc for active RSI */}
            {Array.from({ length: Math.ceil(normalizedRsi) }).map((_, i) => {
              const segStart = (i / 100) * 180
              const segEnd = ((i + 1) / 100) * 180
              const startRad = (segStart * Math.PI) / 180
              const endRad = (segEnd * Math.PI) / 180

              const x1 = Math.round((containerSize / 2 + radius * Math.cos(startRad - Math.PI / 2)) * 100) / 100
              const y1 = Math.round((containerSize / 2 + radius * Math.sin(startRad - Math.PI / 2)) * 100) / 100
              const x2 = Math.round((containerSize / 2 + radius * Math.cos(endRad - Math.PI / 2)) * 100) / 100
              const y2 = Math.round((containerSize / 2 + radius * Math.sin(endRad - Math.PI / 2)) * 100) / 100

              let segColor = '#22a55f'
              if (i > 65) segColor = '#ef4444'
              else if (i > 50) segColor = '#eab308'

              return (
                <path
                  key={`fill-${i}`}
                  d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                  stroke={segColor}
                  strokeWidth={dialWidth}
                  fill="none"
                />
              )
            })}
          </>
        )}

        {/* Needle */}
        <line
          x1={containerSize / 2}
          y1={containerSize / 2}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth={Math.max(1, dialWidth / 2)}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle
          cx={containerSize / 2}
          cy={containerSize / 2}
          r={dialWidth * 1.5}
          fill={color}
        />

        {/* Value text */}
        <text
          x={containerSize / 2}
          y={containerSize / 2 + fontSize / 2}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="600"
          fill="currentColor"
        >
          {Math.round(normalizedRsi)}
        </text>
      </svg>

      {showLabel && (
        <div className="text-xs text-[var(--text-secondary)]">
          {normalizedRsi < 35 ? 'Buy Zone' : normalizedRsi < 65 ? 'Neutral' : 'Overbought'}
        </div>
      )}
    </div>
  )
}
