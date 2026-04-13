"""
Revenue forecasting model using linear regression on monthly revenue series.

Uses only numpy (already in requirements.txt) — no heavy ML dependency needed
for a trend-based short-horizon forecast.
"""

from __future__ import annotations

import numpy as np


class ForecastModel:
    """Projects future revenue using a linear trend fitted on historical data."""

    def predict(
        self,
        monthly_revenue: list[dict],
        periods: int = 3,
    ) -> dict:
        """
        Parameters
        ----------
        monthly_revenue : list of {'month': datetime, 'revenue': Decimal|float}
                          sorted ascending by month.
        periods         : number of future months to forecast.

        Returns
        -------
        dict with trend metrics and forecasted values.
        """
        if not monthly_revenue:
            return self._empty(periods)

        amounts = [float(r.get("revenue") or 0) for r in monthly_revenue]
        n = len(amounts)

        if n < 2:
            # Not enough history — flat forecast
            flat = amounts[0] if amounts else 0.0
            return {
                "data_points": n,
                "current_period_revenue": flat,
                "forecast": [{"period": i + 1, "revenue": round(flat, 2)} for i in range(periods)],
                "growth_rate_pct": 0.0,
                "trend": "insufficient_data",
            }

        x = np.arange(n, dtype=float)
        coeffs = np.polyfit(x, amounts, 1)  # [slope, intercept]
        slope, intercept = float(coeffs[0]), float(coeffs[1])

        forecast = []
        for i in range(1, periods + 1):
            projected = slope * (n - 1 + i) + intercept
            forecast.append({"period": i, "revenue": round(max(projected, 0), 2)})

        current = amounts[-1]
        first = amounts[0]
        growth_rate = ((current - first) / first * 100) if first else 0.0

        trend = "growing" if slope > 0 else ("declining" if slope < 0 else "flat")

        return {
            "data_points": n,
            "current_period_revenue": round(current, 2),
            "forecast": forecast,
            "growth_rate_pct": round(growth_rate, 2),
            "trend": trend,
            "slope_per_month": round(slope, 2),
        }

    @staticmethod
    def _empty(periods: int) -> dict:
        return {
            "data_points": 0,
            "current_period_revenue": 0.0,
            "forecast": [{"period": i + 1, "revenue": 0.0} for i in range(periods)],
            "growth_rate_pct": 0.0,
            "trend": "no_data",
        }
