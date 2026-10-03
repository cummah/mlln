export interface PriceBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vix?: number
}

interface BacktestStats {
  totalInvested: number
  totalShares: number
  avgEntry: number
  currentValue: number
  netProfitPct: number
}

export interface DCAResult {
  backtest: {
    std: BacktestStats
    enh: BacktestStats
    alpha: number
    totalWeeks: number
    dateRange: { from: string; to: string }
  }
  signal: {
    date: string
    rsi: number
    rsiMultiplier: number
    emaDistancePct: number
    emaMultiplier: number
    adx: number
    plusDI: number
    minusDI: number
    regime: 'downtrend' | 'uptrend' | 'ranging'
    regimeMultiplier: number
    drawdownPct: number
    drawdownMultiplier: number
    finalMultiplier: number
    baseAmount: number
    finalAmount: number
    isCapped: boolean
  }
  debugBars?: any[]
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

// Week key matching Pine Script's weekofyear + year
// Pine Script: year * 100 + weekofyear (1-53)
function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const year = d.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((dayOfYear + jan1.getUTCDay()) / 7)
  return `${year * 100 + week}`
}

// ============================================================
// === TV ENHANCED DCA ===
// ============================================================

export interface TVEnhancedDCAOptions {
  baseAmount?: number
  frequency?: 'weekly' | 'monthly' | 'daily'
  slippage?: number
  rsiLength?: number
  rsiLevel1?: number
  rsiLevel2?: number
  rsiLevel3?: number
  rsiLevel4?: number
  buyPercent1?: number
  buyPercent2?: number
  buyPercent3?: number
  buyPercent4?: number
  buyPercent5?: number
  adxPeriod?: number
  adxThreshold?: number
  trendPenalty?: number
  onlyPenalizeDowntrends?: boolean
  drawdownAggression?: number
  maxDrawdownBonus?: number
  drawdownLookback?: number
  extremeDrawdownOverride?: boolean
  extremeDrawdownThreshold?: number
  emaLength?: number
  emaMaxPct?: number
  emaBelowMaxMult?: number
  emaAboveMinMult?: number
  useVIX?: boolean
  vixThreshold?: number
  vixBonusMultiplier?: number
  vixRSICombo?: boolean
  maxTotalMultiplier?: number
  windowStartDate?: string
}

export interface TVSignal {
  date: string
  rsi: number
  rsiMultiplier: number
  emaDistancePct: number
  emaMultiplier: number
  adx: number
  plusDI: number
  minusDI: number
  regime: 'downtrend' | 'uptrend' | 'ranging'
  regimeMultiplier: number
  drawdownPct: number
  drawdownMultiplier: number
  vix: number | null
  vixMultiplier: number
  finalMultiplier: number
  baseAmount: number
  finalAmount: number
  isCapped: boolean
}

export interface TVEnhancedDCAResult {
  signal: TVSignal
  backtest: {
    std: BacktestStats
    enh: BacktestStats
    alpha: number
    purchases: { std: number; enh: number; skipped: number }
    featureTriggers: {
      drawdownBonusCount: number
      regimeReducedCount: number
      regimeOverrideCount: number
      vixBonusCount: number
      emaBonusCount: number
      emaReducedCount: number
    }
    dateRange: { from: string; to: string }
    debugDCADays?: any[]
  }
}

function getMonthKey(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  return `${year}-${month}`
}

export function runTVEnhancedDCA(
  bars: PriceBar[],
  options: TVEnhancedDCAOptions = {}
): TVEnhancedDCAResult {
  if (bars.length < 200) throw new Error('Require at least 200 bars')

  const {
    baseAmount = 100,
    frequency = 'weekly',
    slippage = 0.05,
    rsiLength = 7,
    rsiLevel1 = 35,
    rsiLevel2 = 45,
    rsiLevel3 = 50,
    rsiLevel4 = 55,
    buyPercent1 = 400,
    buyPercent2 = 150,
    buyPercent3 = 50,
    buyPercent4 = 0,
    buyPercent5 = 0,
    adxPeriod = 14,
    adxThreshold = 25,
    trendPenalty = 0.5,
    onlyPenalizeDowntrends = true,
    drawdownAggression = 2.0,
    maxDrawdownBonus = 2.0,
    drawdownLookback = 252,
    extremeDrawdownOverride = true,
    extremeDrawdownThreshold = 20,
    emaLength = 200,
    emaMaxPct = 15.0,
    emaBelowMaxMult = 2.0,
    emaAboveMinMult = 0.0,
    useVIX = false,
    vixThreshold = 25,
    vixBonusMultiplier = 1.5,
    vixRSICombo = true,
    maxTotalMultiplier = 6.0,
    windowStartDate = '',
  } = options

  const n = bars.length

  // Pre-compute indicators
  const rsi = new Float64Array(n).fill(NaN)
  const ema200 = new Float64Array(n).fill(NaN)
  const adx = new Float64Array(n).fill(NaN)
  const plusDI = new Float64Array(n).fill(NaN)
  const minusDI = new Float64Array(n).fill(NaN)
  const drawdown = new Float64Array(n).fill(NaN)

  // RSI (Wilder)
  let sumGain = 0,
    sumLoss = 0
  for (let i = 1; i < Math.min(rsiLength + 1, n); i++) {
    const delta = bars[i].close - bars[i - 1].close
    if (delta > 0) sumGain += delta; else sumLoss += Math.abs(delta)
  }
  let avgGain = sumGain / rsiLength,
    avgLoss = sumLoss / rsiLength
  rsi[rsiLength] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = rsiLength + 1; i < n; i++) {
    const delta = bars[i].close - bars[i - 1].close
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? Math.abs(delta) : 0
    avgGain = (avgGain * (rsiLength - 1) + gain) / rsiLength
    avgLoss = (avgLoss * (rsiLength - 1) + loss) / rsiLength
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  // EMA-200
  let emaSum = 0
  for (let i = 0; i < emaLength && i < n; i++) emaSum += bars[i].close
  ema200[emaLength - 1] = emaSum / emaLength
  const emaK = 2 / (emaLength + 1)
  for (let i = emaLength; i < n; i++) {
    ema200[i] = bars[i].close * emaK + ema200[i - 1] * (1 - emaK)
  }

  // ADX / DI (Wilder)
  const tr = new Float64Array(n),
    plusDM = new Float64Array(n),
    minusDM = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const h = bars[i].high,
      l = bars[i].low
    const hc = i > 0 ? bars[i - 1].close : l
    tr[i] = Math.max(h - l, Math.abs(h - hc), Math.abs(l - hc))
    if (i > 0) {
      const hDelta = h - bars[i - 1].high
      const lDelta = bars[i - 1].low - l
      plusDM[i] = hDelta > 0 && hDelta > lDelta ? hDelta : 0
      minusDM[i] = lDelta > 0 && lDelta > hDelta ? lDelta : 0
    }
  }

  let trSum = 0,
    plusDMSum = 0,
    minusDMSum = 0
  for (let i = 0; i < adxPeriod && i < n; i++) {
    trSum += tr[i]
    plusDMSum += plusDM[i]
    minusDMSum += minusDM[i]
  }
  let smoothTR = trSum,
    smoothPlusDM = plusDMSum,
    smoothMinusDM = minusDMSum
  plusDI[adxPeriod - 1] = (plusDMSum / trSum) * 100
  minusDI[adxPeriod - 1] = (minusDMSum / trSum) * 100

  for (let i = adxPeriod; i < n; i++) {
    smoothTR = smoothTR - smoothTR / adxPeriod + tr[i]
    smoothPlusDM = smoothPlusDM - smoothPlusDM / adxPeriod + plusDM[i]
    smoothMinusDM = smoothMinusDM - smoothMinusDM / adxPeriod + minusDM[i]
    plusDI[i] = (smoothPlusDM / smoothTR) * 100
    minusDI[i] = (smoothMinusDM / smoothTR) * 100
  }

  let dxSum = 0
  const dx = new Float64Array(n)
  for (let i = adxPeriod - 1; i < n; i++) {
    dx[i] = Math.abs(plusDI[i] - minusDI[i]) / (plusDI[i] + minusDI[i]) * 100
    if (i < adxPeriod - 1 + adxPeriod) dxSum += dx[i]
  }
  adx[2 * adxPeriod - 2] = dxSum / adxPeriod
  for (let i = 2 * adxPeriod - 1; i < n; i++) {
    adx[i] = (adx[i - 1] * (adxPeriod - 1) + dx[i]) / adxPeriod
  }

  // Drawdown
  let rollingHigh = bars[0].high
  for (let i = 0; i < n; i++) {
    if (i < drawdownLookback) {
      rollingHigh = Math.max(rollingHigh, bars[i].high)
    } else {
      rollingHigh = -Infinity
      for (let j = i - drawdownLookback + 1; j <= i; j++) {
        rollingHigh = Math.max(rollingHigh, bars[j].high)
      }
    }
    drawdown[i] = rollingHigh > 0 ? (rollingHigh - bars[i].close) / rollingHigh : 0
  }

  // First pass: Find date range based on all possible DCA periods
  let allPeriodKeysFirstPass = new Set<string>()
  let dateRangeStart = '',
    dateRangeEnd = ''

  for (let i = 0; i < n; i++) {
    const date = new Date(bars[i].date + 'T12:00:00Z')
    const dayOfWeek = date.getUTCDay()
    let periodKey: string
    let isDCADay = false

    if (frequency === 'weekly') {
      periodKey = weekKey(bars[i].date)
      isDCADay = dayOfWeek >= 1
    } else if (frequency === 'daily') {
      periodKey = bars[i].date
      isDCADay = true
    } else {
      periodKey = getMonthKey(bars[i].date)
      isDCADay = true
    }

    if (isDCADay && !allPeriodKeysFirstPass.has(periodKey)) {
      allPeriodKeysFirstPass.add(periodKey)
      if (!dateRangeStart) dateRangeStart = bars[i].date
      dateRangeEnd = bars[i].date
    }
  }

  // Main loop
  let stdInvested = 0,
    stdShares = 0,
    enhInvested = 0,
    enhShares = 0
  let stdPurchases = 0,
    enhPurchases = 0,
    skippedCount = 0

  let pendingOrder: any = null
  let lastPeriodKey: string | null = null
  let allPeriodKeys = new Set<string>()

  const featureTriggers = {
    drawdownBonusCount: 0,
    regimeReducedCount: 0,
    regimeOverrideCount: 0,
    vixBonusCount: 0,
    emaBonusCount: 0,
    emaReducedCount: 0,
  }

  const debugDCADays: any[] = []

  function computeMults(i: number) {
    if (isNaN(rsi[i]) || isNaN(ema200[i]) || isNaN(adx[i])) return null

    const rsiVal = rsi[i]
    let rsiMult = buyPercent5 / 100
    if (rsiVal <= rsiLevel1) rsiMult = buyPercent1 / 100
    else if (rsiVal <= rsiLevel2) rsiMult = buyPercent2 / 100
    else if (rsiVal <= rsiLevel3) rsiMult = buyPercent3 / 100
    else if (rsiVal <= rsiLevel4) rsiMult = buyPercent4 / 100

    const emaDist = ((bars[i].close - ema200[i]) / ema200[i]) * 100
    const emaNorm = clamp(emaDist / emaMaxPct, -1, 1)
    let emaMult = 1.0
    if (emaNorm < 0) {
      emaMult = 1.0 + Math.abs(emaNorm) * (emaBelowMaxMult - 1)
    } else {
      emaMult = 1.0 - emaNorm * (1 - emaAboveMinMult)
    }

    const isTrending = adx[i] > adxThreshold
    const isTrendingDown = isTrending && minusDI[i] > plusDI[i]
    const isExtremeDD = drawdown[i] * 100 >= extremeDrawdownThreshold
    const extremeOverride = extremeDrawdownOverride && isExtremeDD

    let shouldApplyPenalty = onlyPenalizeDowntrends ? isTrendingDown : isTrending
    if (extremeOverride) shouldApplyPenalty = false

    const regimeAdj = shouldApplyPenalty ? trendPenalty : 1.0
    const regimeOverridden = isTrendingDown && extremeOverride

    const rawDD = 1 + drawdown[i] * drawdownAggression
    const ddBonus = Math.min(rawDD, maxDrawdownBonus)
    const isDDActive = ddBonus > 1.0

    const isRSIOversold = rsiVal <= rsiLevel3
    const vixVal = bars[i].vix
    const isVIXElevated = vixVal !== undefined && vixVal > vixThreshold
    const vixCondition = useVIX && isVIXElevated && (!vixRSICombo || isRSIOversold)
    const vixBonus = vixCondition ? vixBonusMultiplier : 1.0

    const rawFinal = rsiMult * regimeAdj * ddBonus * vixBonus * emaMult
    const finalMult = Math.min(rawFinal, maxTotalMultiplier)
    const isCapped = rawFinal > maxTotalMultiplier

    return {
      rsiMult,
      emaMult,
      regimeAdj,
      ddBonus,
      vixBonus,
      finalMult,
      isCapped,
      shouldApplyPenalty,
      regimeOverridden,
      isDDActive,
      vixCondition,
      isEMABonus: emaMult > 1.0,
      isEMAReduced: emaMult < 1.0,
      emaDist,
      drawdownPct: drawdown[i] * 100,
      rsiVal,
    }
  }

  // Parse window start date for proper comparison
  const windowStartTime = windowStartDate ? new Date(windowStartDate + 'T00:00:00Z').getTime() : null

  for (let i = 0; i < n; i++) {
    // Phase 1: Execute pending order at open
    if (pendingOrder) {
      const execPrice = bars[i].open * (1 + slippage / 100)
      const orderTime = new Date(pendingOrder.date + 'T00:00:00Z').getTime()
      const isInWindow = !windowStartTime || orderTime >= windowStartTime

      if (isInWindow) {
        const stdQty = pendingOrder.stdAmount / execPrice
        stdInvested += pendingOrder.stdAmount
        stdShares += stdQty
        stdPurchases++

        if (pendingOrder.enhAmount > 0) {
          const enhQty = pendingOrder.enhAmount / execPrice
          enhInvested += pendingOrder.enhAmount
          enhShares += enhQty
          enhPurchases++
        } else {
          skippedCount++
        }

        if (!dateRangeStart) dateRangeStart = pendingOrder.date
        dateRangeEnd = bars[i].date
      }

      if (isInWindow) {
        if (pendingOrder.drawdownBonusActive) featureTriggers.drawdownBonusCount++
        if (pendingOrder.regimeReduced) featureTriggers.regimeReducedCount++
        if (pendingOrder.regimeOverridden) featureTriggers.regimeOverrideCount++
        if (pendingOrder.vixBonusActive) featureTriggers.vixBonusCount++
        if (pendingOrder.emaBonusActive) featureTriggers.emaBonusCount++
        if (pendingOrder.emaReducedActive) featureTriggers.emaReducedCount++
      }

      pendingOrder = null
    }

    // Phase 2: Check if this is a DCA signal day
    const date = new Date(bars[i].date + 'T12:00:00Z')
    const dayOfWeek = date.getUTCDay()
    let periodKey: string
    let isDCADay = false
    let canSignalToday = false

    if (frequency === 'weekly') {
      periodKey = weekKey(bars[i].date)
      // Pine: isDCADay = dayofweek >= getDayOfWeekNumber(dcaDayOfWeek)
      isDCADay = dayOfWeek >= 1  // Monday (1) through Saturday (6)
      // Pine: stdCanSignalToday = isDCADay and stdLastActionPeriod != currentPeriod
      canSignalToday = isDCADay && periodKey !== lastPeriodKey
    } else if (frequency === 'daily') {
      periodKey = bars[i].date
      // Pine: isDCADay = each trading day is eligible
      isDCADay = true
      // Pine: stdCanSignalToday = isDCADay and stdLastActionPeriod != currentPeriod
      canSignalToday = isDCADay && periodKey !== lastPeriodKey
    } else {
      periodKey = getMonthKey(bars[i].date)
      // Pine: isDCADay = dayofmonth >= dcaDayOfMonth (default 1, so always true)
      isDCADay = true
      // Pine: stdCanSignalToday = isDCADay and stdLastActionPeriod != currentPeriod
      canSignalToday = isDCADay && periodKey !== lastPeriodKey
    }

    if (canSignalToday) {
      allPeriodKeys.add(periodKey)
      const mults = computeMults(i)
      if (mults) {
        lastPeriodKey = periodKey
        pendingOrder = {
          date: bars[i].date,
          stdAmount: baseAmount,
          enhAmount: baseAmount * mults.finalMult,
          drawdownBonusActive: mults.isDDActive,
          regimeReduced: mults.shouldApplyPenalty,
          regimeOverridden: mults.regimeOverridden,
          vixBonusActive: mults.vixCondition,
          emaBonusActive: mults.isEMABonus,
          emaReducedActive: mults.isEMAReduced,
        }
        debugDCADays.push({
          date: bars[i].date,
          rsi: mults.rsiVal,
          rsiMult: mults.rsiMult,
          emaMult: mults.emaMult,
          regimeAdj: mults.regimeAdj,
          ddBonus: mults.ddBonus,
          vixBonus: mults.vixBonus,
          finalMult: mults.finalMult,
          isSkipped: mults.finalMult === 0,
          // For debugging: show if close to threshold
          rsiCloseTo55: Math.abs(mults.rsiVal - 55) < 2,
        })
      }
    }
  }

  // Signal (last bar)
  const lastMults = computeMults(n - 1)!
  const stdCurrentValue = stdShares * bars[n - 1].close
  const enhCurrentValue = enhShares * bars[n - 1].close

  return {
    signal: {
      date: bars[n - 1].date,
      rsi: lastMults.rsiVal,
      rsiMultiplier: lastMults.rsiMult,
      emaDistancePct: lastMults.emaDist,
      emaMultiplier: lastMults.emaMult,
      adx: adx[n - 1],
      plusDI: plusDI[n - 1],
      minusDI: minusDI[n - 1],
      regime: minusDI[n - 1] > plusDI[n - 1] && adx[n - 1] > adxThreshold ? 'downtrend' : adx[n - 1] > adxThreshold ? 'uptrend' : 'ranging',
      regimeMultiplier: lastMults.regimeAdj,
      drawdownPct: lastMults.drawdownPct,
      drawdownMultiplier: lastMults.ddBonus,
      vix: bars[n - 1].vix ?? null,
      vixMultiplier: lastMults.vixBonus,
      finalMultiplier: lastMults.finalMult,
      baseAmount,
      finalAmount: baseAmount * lastMults.finalMult,
      isCapped: lastMults.isCapped,
    },
    backtest: {
      std: {
        totalInvested: stdInvested,
        totalShares: stdShares,
        avgEntry: stdShares > 0 ? stdInvested / stdShares : 0,
        currentValue: stdCurrentValue,
        netProfitPct: stdInvested > 0 ? ((stdCurrentValue - stdInvested) / stdInvested) * 100 : 0,
      },
      enh: {
        totalInvested: enhInvested,
        totalShares: enhShares,
        avgEntry: enhShares > 0 ? enhInvested / enhShares : 0,
        currentValue: enhCurrentValue,
        netProfitPct: enhInvested > 0 ? ((enhCurrentValue - enhInvested) / enhInvested) * 100 : 0,
      },
      alpha: (enhInvested > 0 ? ((enhCurrentValue - enhInvested) / enhInvested) * 100 : 0) - (stdInvested > 0 ? ((stdCurrentValue - stdInvested) / stdInvested) * 100 : 0),
      purchases: { std: stdPurchases, enh: enhPurchases, skipped: skippedCount },
      featureTriggers,
      dateRange: { from: dateRangeStart, to: dateRangeEnd },
      debugDCADays,
    },
  }
}
