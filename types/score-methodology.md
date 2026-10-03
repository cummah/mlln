# Enhanced DCA Suitability Score — Methodology

**Column:** `backtest_summary.dca_suitability_score`  
**Range:** 1–100  
**Purpose:** Measures how well-suited an individual asset is for the Enhanced DCA strategy, based purely on backtested performance data. A high score means the signal-driven mechanics (RSI bands, EMA distance, drawdown multiplier, regime filter) work well for that asset's price behaviour.

> This is NOT a measure of raw return quality. It specifically measures whether Enhanced DCA adds value *over* Standard DCA for that asset.

---

## Scoring Components

### Component 1 — Alpha Consistency (35 pts)

**Question:** Does Enhanced DCA reliably beat Standard DCA for this asset?

#### 1a. Alpha Magnitude (20 pts)
- Compute average long-term alpha: `mean(alpha_1y, alpha_3y, alpha_5y)`
- Percentile-rank this value across all assets in the universe
- Map percentile to points: top decile (90th+) → 20pts, median (50th) → 10pts, bottom decile → 0pts
- Negative average alpha is hard-capped at 0pts

#### 1b. Directional Consistency (15 pts)
- Count how many of the 5 windows show positive alpha: `alpha_1m`, `alpha_3m`, `alpha_1y`, `alpha_3y`, `alpha_5y`
- Score: 3 pts per window with positive alpha (max 15pts)
- An asset that only outperforms in one window is unreliable; this penalises inconsistency

**Columns used:** `alpha_1m`, `alpha_3m`, `alpha_1y`, `alpha_3y`, `alpha_5y`

---

### Component 2 — Absolute Profitability (25 pts)

**Question:** Is Enhanced DCA actually making money on this asset?

An asset can have positive alpha over Standard DCA while still losing money — e.g. ENH=-50%, STD=-60%. That is not a suitable investment regardless of alpha.

- **5Y profitable (enh_return_5y > 0):** +12 pts base
- **3Y profitable (enh_return_3y > 0):** +8 pts base
- **1Y profitable (enh_return_1y > 0):** +5 pts base
- For each profitable window, scale the points by the return magnitude (percentile-ranked), so higher returns earn proportionally more
- If `enh_return_5y < 0`, cap entire component at 5pts maximum (no amount of short-term profitability rescues a structurally declining asset)

**Columns used:** `enh_return_1y`, `enh_return_3y`, `enh_return_5y`

---

### Component 3 — Capital Efficiency (20 pts)

**Question:** Is the signal buying at genuinely lower prices?

This is mechanical proof that the RSI/drawdown signals are timing entries correctly — not just getting lucky with returns.

#### 3a. Average Entry Discount (12 pts)
- Compute: `entry_discount = (std_avg_entry_5y - enh_avg_entry_5y) / std_avg_entry_5y * 100`
- This is the % cheaper that Enhanced DCA buys vs Standard DCA on average
- Percentile-rank across universe; scale to 0–12pts
- Negative discount (ENH buying at higher price) → 0pts

#### 3b. Return per Dollar Invested (8 pts)
- Compute efficiency ratio: `(enh_value_5y / enh_invested_5y) / (std_value_5y / std_invested_5y)`
- Ratio > 1.0 means ENH achieves more value per dollar invested → scale to 0–8pts
- Ratio ≤ 1.0 → 0pts

**Columns used:** `enh_avg_entry_5y`, `std_avg_entry_5y`, `enh_value_5y`, `enh_invested_5y`, `std_value_5y`, `std_invested_5y`

---

### Component 4 — Short-Term Defence (10 pts)

**Question:** Does Enhanced DCA protect capital in current/recent conditions?

This measures whether the signal is actively working *right now*, not just in historical bull markets.

- `alpha_1m > 0` → 5 pts
- `alpha_3m > 0` → 5 pts

**Columns used:** `alpha_1m`, `alpha_3m`

---

### Component 5 — Weekly/Monthly Signal Convergence (10 pts)

**Question:** Do both the weekly and monthly signal variants independently agree?

Convergence across frequencies suggests the asset exhibits genuine mean-reverting oversold patterns that Enhanced DCA is designed to exploit — rather than noise in a single timeframe.

- Count windows where both weekly alpha and monthly alpha are positive:
  - Check `alpha_1y > 0` AND `monthly_alpha_1y > 0`
  - Check `alpha_3y > 0` AND `monthly_alpha_3y > 0`
  - Check `alpha_5y > 0` AND `monthly_alpha_5y > 0`
- 3.33 pts per converging window (max 10pts, rounded)

**Columns used:** `alpha_1y`, `monthly_alpha_1y`, `alpha_3y`, `monthly_alpha_3y`, `alpha_5y`, `monthly_alpha_5y`

---

### Overall Ceiling — Absolute Loss Severity

**Question:** Can strong alpha alone rescue an asset that's losing serious money?

Components 1, 4, and 5 (55 of 100 pts) measure alpha *relative to Standard DCA* and don't look at absolute returns at all. An asset that outperforms Standard DCA in every window while still losing heavily in absolute terms (e.g. ENH=-47% over 5y, but STD would have lost even more) can accumulate most of those 55 points. The Component 2 hard-cap only constrains its own 25-pt budget, which isn't enough to stop the total from reading as "Good."

After the components above are summed, a ceiling is applied based on `enh_return_5y`:

| `enh_return_5y` | Score ceiling |
|---|---|
| ≤ -50% | 25 |
| ≤ -30% | 40 |
| ≤ -10% | 55 |
| < 0% | 70 |
| ≥ 0% | 100 (no ceiling) |

This ensures persistent, severe absolute losses cap the asset out of "Excellent"/"Good" regardless of how favorably it compares to Standard DCA.

**Columns used:** `enh_return_5y`

---

## Score Interpretation

| Score | Band | Interpretation |
|-------|------|----------------|
| 80–100 | ⭐ Excellent | Ideal candidate. Strong alpha, profitable, signal firing across all frames. Suitable for full Enhanced DCA allocation. |
| 60–79 | ✅ Good | Mostly works with minor inconsistencies. Suitable for standard Enhanced DCA position sizing. |
| 40–59 | ⚠️ Marginal | Alpha exists but patchy or absolute returns are weak. Consider reduced allocation or monitor. |
| 20–39 | ❌ Poor fit | Enhanced adds little over standard or asset is structurally challenged. Prefer Standard DCA if investing at all. |
| 1–19 | 🚫 Unsuitable | Persistent negative alpha or losses across all windows. Not suitable for any DCA variant. |

---

## Implementation Notes

- Scores are computed by `scripts/compute-dca-scores.ts` and stored in `backtest_summary.dca_suitability_score`
- All percentile rankings are computed **within the live universe** at time of scoring — scores will shift as assets are added/removed
- Minimum 1 point is always assigned (no zeroes) to distinguish "scored but unsuitable" from "not yet scored"
- Re-run after each `compute:summary` execution to keep scores current

---

## Score Distribution (reference, April 2026, 708 assets)

| Band | Count | % of Universe |
|------|-------|---------------|
| 80–100 | ~180 | ~25% |
| 60–79 | ~210 | ~30% |
| 40–59 | ~160 | ~23% |
| 20–39 | ~100 | ~14% |
| 1–19 | ~58 | ~8% |
