"""
Retention agent — analyses churn risk and retention health.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector
from models.churn_model import ChurnModel
from utils.data_loader import (
    load_customer_events,
    load_customers,
    load_inactive_customers,
    load_subscriptions,
)
from utils.insight_formatter import format_agent_result, format_error

from agents.base_agent import BaseAgent


class RetentionAgent(BaseAgent):
    agent_type = "RETENTION"

    def analyze(self, organization_id: str) -> dict:
        try:
            customers = load_customers(organization_id, self.db)
            events = load_customer_events(organization_id, self.db, days=90)
            subscriptions = load_subscriptions(organization_id, self.db)
            inactive_30 = load_inactive_customers(organization_id, self.db, inactive_days=30)
            inactive_60 = load_inactive_customers(organization_id, self.db, inactive_days=60)

            churn_scores = ChurnModel().score(customers, events)

            total_customers = len(customers)
            active_subs = sum(1 for s in subscriptions if s.get("status") == "ACTIVE")
            canceled_subs = sum(1 for s in subscriptions if s.get("status") == "CANCELED")
            total_subs = len(subscriptions) or 1

            retention_rate = round(active_subs / total_subs, 4) if total_subs else 0.0
            churn_rate = round(canceled_subs / total_subs, 4) if total_subs else 0.0
            high_risk_pct = churn_scores["high_risk_pct"]

            if churn_rate > 0.15 or high_risk_pct > 0.3:
                recommendation = (
                    "Churn risk is critical. Launch an immediate win-back campaign targeting "
                    "high-risk segments with personalised outreach and time-limited offers."
                )
                confidence = 0.85
            elif high_risk_pct > 0.15 or inactive_30 > total_customers * 0.2:
                recommendation = (
                    "Elevated churn signals detected. Implement proactive lifecycle messaging "
                    "for customers inactive 30+ days and review onboarding completion rates."
                )
                confidence = 0.75
            else:
                recommendation = (
                    "Retention looks healthy. Reinforce high-LTV customer loyalty with "
                    "milestone rewards and early renewal incentives."
                )
                confidence = 0.7

            metrics = {
                "total_customers": total_customers,
                "active_subscriptions": active_subs,
                "canceled_subscriptions": canceled_subs,
                "retention_rate": retention_rate,
                "churn_rate": churn_rate,
                "high_risk_customers": churn_scores["high_risk_count"],
                "medium_risk_customers": churn_scores["medium_risk_count"],
                "high_risk_pct": high_risk_pct,
                "inactive_30d": inactive_30,
                "inactive_60d": inactive_60,
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
