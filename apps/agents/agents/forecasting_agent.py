"""
Forecasting agent — projects revenue trend for the next 3 months.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector
from models.forecast_model import ForecastModel
from models.revenue_model import RevenueModel
from utils.data_loader import load_monthly_revenue, load_revenue_events
from utils.insight_formatter import format_agent_result, format_error

from agents.base_agent import BaseAgent


class ForecastingAgent(BaseAgent):
    agent_type = "FORECASTING"

    def analyze(self, organization_id: str) -> dict:
        try:
            monthly_series = load_monthly_revenue(organization_id, self.db, months=12)
            revenue_events = load_revenue_events(organization_id, self.db, days=365)

            forecast_result = ForecastModel().predict(monthly_series, periods=3)
            revenue_metrics = RevenueModel().compute_metrics(revenue_events)

            growth_rate = forecast_result["growth_rate_pct"]
            trend = forecast_result["trend"]
            next_month = (
                forecast_result["forecast"][0]["revenue"]
                if forecast_result["forecast"]
                else 0
            )

            if trend == "declining" or growth_rate < -10:
                recommendation = (
                    "Revenue is trending down. Build a downside scenario plan, freeze low-ROI "
                    "spend, and identify the top 3 revenue recovery levers for this quarter."
                )
                confidence = 0.82
            elif trend in ("no_data", "insufficient_data"):
                recommendation = (
                    "Insufficient revenue history for reliable forecasting. Focus on establishing "
                    "consistent tracking and ensure all revenue events are being captured."
                )
                confidence = 0.5
            elif growth_rate < 5:
                recommendation = (
                    "Revenue growth is stagnant. Explore expansion revenue through upsell "
                    "campaigns for existing customers before investing in new acquisition."
                )
                confidence = 0.75
            else:
                recommendation = (
                    "Growth trajectory looks positive. Invest in top-performing channels "
                    "and monitor monthly forecasts weekly to catch deviations early."
                )
                confidence = 0.78

            metrics = {
                **forecast_result,
                "mrr_estimate": revenue_metrics["mrr_estimate"],
                "arr_estimate": revenue_metrics["arr_estimate"],
                "net_revenue_12m": revenue_metrics["net_revenue"],
                "projected_next_month": next_month,
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
