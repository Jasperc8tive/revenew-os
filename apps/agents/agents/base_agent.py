"""Base class for all AI agents."""

from __future__ import annotations

from abc import ABC, abstractmethod

from connectors.db_connector import DBConnector
from utils.insight_formatter import safe_divide, safe_float


class BaseAgent(ABC):
    """Common interface and shared helpers for every agent."""

    agent_type: str = "BASE"

    def __init__(self, db: DBConnector) -> None:
        self.db = db

    @abstractmethod
    def analyze(self, organization_id: str) -> dict:
        """Run analysis for the given org and return a standardised result dict."""

    # ── Shared helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _safe_divide(a, b, default: float = 0.0) -> float:
        return safe_divide(a, b, default)

    @staticmethod
    def _safe_float(v, default: float = 0.0) -> float:
        return safe_float(v, default)
