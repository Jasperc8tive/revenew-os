"""
Standardises agent output into the response shape consumed by the NestJS API.
"""

from __future__ import annotations

from datetime import datetime, timezone


def format_agent_result(
    agent_type: str,
    organization_id: str,
    metrics: dict,
    recommendation: str,
    confidence: float = 0.7,
) -> dict:
    """Wrap agent metrics into the standard response envelope."""
    return {
        "agent_type": agent_type,
        "organization_id": organization_id,
        "status": "success",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "confidence": round(max(0.0, min(1.0, confidence)), 3),
        "metrics": metrics,
        "recommendation": recommendation,
    }


def format_error(agent_type: str, organization_id: str, error: str) -> dict:
    return {
        "agent_type": agent_type,
        "organization_id": organization_id,
        "status": "error",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "error": error,
    }


def safe_float(value, default: float = 0.0) -> float:
    """Convert Decimal / None / str to float without raising."""
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def safe_divide(numerator, denominator, default: float = 0.0) -> float:
    """Division that returns *default* instead of ZeroDivisionError."""
    try:
        n = float(numerator)
        d = float(denominator)
        return n / d if d != 0 else default
    except (TypeError, ValueError):
        return default
