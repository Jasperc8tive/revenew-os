"""
PostgreSQL connector backed by a SQLAlchemy engine.

One engine per process (pool_size=5).  Each execute() call borrows a
connection from the pool, runs the query, and returns it immediately.
"""

import os
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


class DBConnector:
    """Manages database connections and queries."""

    def __init__(self) -> None:
        url = os.getenv("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        self._engine: Engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )

    def execute(self, sql: str, params: dict[str, Any] | None = None) -> list[dict]:
        """Return all rows as a list of plain dicts."""
        with self._engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            keys = list(result.keys())
            return [dict(zip(keys, row)) for row in result.fetchall()]

    def execute_scalar(self, sql: str, params: dict[str, Any] | None = None) -> Any:
        """Return the first column of the first row, or None."""
        with self._engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            row = result.fetchone()
            return row[0] if row else None

    def close(self) -> None:
        """Dispose the connection pool (call at app shutdown)."""
        self._engine.dispose()
