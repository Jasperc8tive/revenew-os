"""
Growth agent — synthesises metrics across revenue, retention, acquisition,
and pipeline to produce an overall health score and top growth priority.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector
from models.forecast_model import ForecastModel
from models.revenue_model import RevenueModel
from utils.data_loader import (
    load_customers,
    load_deals,
    load_inactive_customers,
    load_monthly_revenue,
    load_revenue_events,
    load_subscriptions,
)
from utils.insight_formatter import format_agent_result, format_error

from agents.base_agent import BaseAgent


class GrowthAgent(BaseAgent):
    agent_type = "GROWTH"

    def analyze(self, organization_id: str) -> dict:
        try:
            revenue_events = load_revenue_events(organization_id, self.db, days=365)
            monthly_series = load_monthly_revenue(organization_id, self.db, months=12)
            subscriptions = load_subscriptions(organization_id, self.db)
            customers = load_customers(organization_id, self.db)
            deals = load_deals(organization_id, self.db)
            inactive_30 = load_inactive_customers(organization_id, self.db, inactive_days=30)

            revenue_metrics = RevenueModel().compute_metrics(revenue_events)
            forecast = ForecastModel().predict(monthly_series, periods=3)

            total_subs = len(subscriptions) or 1
            active_subs = sum(1 for s in subscriptions if s.get("status") == "ACTIVE")
            canceled_subs = sum(1 for s in subscriptions if s.get("status") == "CANCELED")
            retention_rate = self._safe_divide(active_subs, total_subs)
            churn_rate = self._safe_divide(canceled_subs, total_subs)

            total_customers = len(customers)
            upgrades = sum(1 for e in revenue_events if e.get("type") == "UPGRADE")
            downgrades = sum(1 for e in revenue_events if e.get("type") == "DOWNGRADE")
            expansion_ratio = self._safe_divide(upgrades, downgrades or 1)

            won_deals = sum(1 for d in deals if d.get("stage") == "WON")
            total_closed = sum(1 for d in deals if d.get("stage") in ("WON", "LOST"))
            win_rate = self._safe_divide(won_deals, total_closed) if total_closed else 0.5

            # Composite health score (0–100), each signal up to 25 pts
            revenue_score = min(25.0, max(0.0, 12.5 + forecast["growth_rate_pct"] * 0.5))
            retention_score = min(25.0, retention_rate * 25)
            pipeline_score = min(25.0, win_rate * 25)
            activity_score = min(
                25.0,
                25 * (1 - self._safe_divide(inactive_30, total_customers or 1)),
            )
            health_score = round(revenue_score + retention_score + pipeline_score + activity_score, 1)

            scores = {
                "revenue_growth": revenue_score,
                "retention": retention_score,
                "pipeline": pipeline_score,
                "customer_activity": activity_score,
            }
            top_priority_key = min(scores, key=lambda k: scores[k])
            priority_map = {
                "revenue_growth": "Drive revenue growth — investigate top channel ROI and expand winning campaigns.",
                "retention": "Fix retention — launch churn recovery flow for high-risk customers immediately.",
                "pipeline": "Improve pipeline — enforce stage SLAs and tighten deal qualification.",
                "customer_activity": "Re-engage dormant customers — run a re-activation campaign for inactive cohorts.",
            }
            top_priority = priority_map[top_priority_key]

            if health_score >= 70:
                recommendation = (
                    f"Business health is strong (score: {health_score}/100). "
                    "Execute the top growth initiative and track weekly verified metrics snapshots."
                )
                confidence = 0.8
            elif health_score >= 45:
                recommendation = (
                    f"Business health needs attention (score: {health_score}/100). "
                    f"Top priority: {top_priority}"
                )
                confidence = 0.78
            else:
                recommendation = (
                    f"Business health is at risk (score: {health_score}/100). "
                    f"Urgent: {top_priority}"
                )
                confidence = 0.85

            metrics = {
                "health_score": health_score,
                "top_priority": top_priority_key,
                "revenue": {
                    "mrr_estimate": revenue_metrics["mrr_estimate"],
                    "arr_estimate": revenue_metrics["arr_estimate"],
                    "net_revenue_12m": revenue_metrics["net_revenue"],
                    "growth_rate_pct": forecast["growth_rate_pct"],
                    "trend": forecast["trend"],
                },
                "retention": {
                    "retention_rate": round(retention_rate, 4),
                    "churn_rate": round(churn_rate, 4),
                    "active_subscriptions": active_subs,
                    "inactive_customers_30d": inactive_30,
                },
                "pipeline": {
                    "total_deals": len(deals),
                    "win_rate": round(win_rate, 4),
                },
                "expansion": {
                    "upgrades_12m": upgrades,
                    "downgrades_12m": downgrades,
                    "expansion_ratio": round(expansion_ratio, 2),
                },
                "score_breakdown": {k: round(v, 1) for k, v in scores.items()},
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
