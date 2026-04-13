"""
Marketing agent — analyses channel performance and spend efficiency.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector
from utils.data_loader import load_marketing_metrics
from utils.insight_formatter import format_agent_result, format_error, safe_float

from agents.base_agent import BaseAgent


class MarketingAgent(BaseAgent):
    agent_type = "MARKETING"

    def analyze(self, organization_id: str) -> dict:
        try:
            channels = load_marketing_metrics(organization_id, self.db, days=30)

            if not channels:
                return format_agent_result(
                    self.agent_type,
                    organization_id,
                    {"message": "No marketing data found for the last 30 days"},
                    "Connect marketing integrations to unlock channel performance analysis.",
                    confidence=0.5,
                )

            enriched = []
            total_spend = 0.0
            total_conversions = 0

            for ch in channels:
                spend = safe_float(ch.get("spend"))
                clicks = int(ch.get("clicks") or 0)
                impressions = int(ch.get("impressions") or 0)
                conversions = int(ch.get("conversions") or 0)

                ctr = self._safe_divide(clicks, impressions) * 100
                cpc = self._safe_divide(spend, clicks or 1)
                cpa = self._safe_divide(spend, conversions or 1)
                cvr = self._safe_divide(conversions, clicks or 1) * 100

                total_spend += spend
                total_conversions += conversions

                enriched.append({
                    "channel": ch.get("channel_name"),
                    "type": ch.get("channel_type"),
                    "spend": round(spend, 2),
                    "impressions": impressions,
                    "clicks": clicks,
                    "conversions": conversions,
                    "ctr_pct": round(ctr, 2),
                    "cpc": round(cpc, 2),
                    "cpa": round(cpa, 2),
                    "cvr_pct": round(cvr, 2),
                })

            sortable = [c for c in enriched if c["conversions"] > 0]
            if sortable:
                best = min(sortable, key=lambda x: x["cpa"])["channel"]
                worst = max(sortable, key=lambda x: x["cpa"])["channel"]
            else:
                best = worst = None

            avg_cpa = self._safe_divide(total_spend, total_conversions or 1)

            if total_spend == 0:
                recommendation = "No marketing spend recorded. Activate at least one paid channel to generate acquisition data."
                confidence = 0.6
            elif total_conversions == 0:
                recommendation = (
                    "Spend is running but no conversions are tracked. Audit conversion tracking "
                    "setup across all active campaigns immediately."
                )
                confidence = 0.85
            elif avg_cpa > 500:
                recommendation = (
                    f"Average CPA is high. Pause the worst-performing channel "
                    f"and reallocate budget to '{best}' which has the lowest CPA."
                )
                confidence = 0.8
            else:
                recommendation = (
                    f"Marketing efficiency is acceptable. Double down on '{best}' and run "
                    "A/B creative tests to reduce CPA further before scaling spend."
                )
                confidence = 0.72

            metrics = {
                "total_spend_30d": round(total_spend, 2),
                "total_conversions_30d": total_conversions,
                "avg_cpa": round(avg_cpa, 2),
                "best_channel_by_cpa": best,
                "worst_channel_by_cpa": worst,
                "channels": enriched,
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
