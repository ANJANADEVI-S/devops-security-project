"""
Metrics Service — Prometheus counters and gauges for M4 monitoring.
Exposes a /metrics endpoint in Prometheus text format.
"""

from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
from src.database import get_db


# ---------------------------------------------------------------------------
# Custom application metrics
# ---------------------------------------------------------------------------

TOTAL_USERS = Gauge(
    "app_total_users",
    "Total number of registered users",
    ["role"],
)

TOTAL_SECRETS = Gauge(
    "app_total_secrets",
    "Total number of secrets stored",
)

ACCESS_REQUESTS = Counter(
    "app_access_requests_total",
    "Total access requests by status",
    ["status"],
)

SECRETS_REVOKED = Counter(
    "app_secrets_revoked_total",
    "Total number of secrets revoked due to deadline expiry",
)

SECRETS_GENERATED = Counter(
    "app_secrets_generated_total",
    "Total number of new passwords generated after revocation",
)

ACTIVE_GRANTS = Gauge(
    "app_active_grants",
    "Number of currently active access grants",
)

HTTP_REQUESTS = Counter(
    "app_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)


def refresh_gauges():
    """Pull fresh counts from SQLite and update Prometheus gauges."""
    try:
        conn = get_db()
        cursor = conn.cursor()

        # User counts by role
        for role in ("manager", "employee"):
            count = cursor.execute(
                "SELECT COUNT(*) FROM users WHERE role = ?", (role,)
            ).fetchone()[0]
            TOTAL_USERS.labels(role=role).set(count)

        # Total secrets
        count = cursor.execute("SELECT COUNT(*) FROM secrets").fetchone()[0]
        TOTAL_SECRETS.set(count)

        # Active grants
        count = cursor.execute(
            "SELECT COUNT(*) FROM access_grants WHERE status = 'active'"
        ).fetchone()[0]
        ACTIVE_GRANTS.set(count)

        conn.close()
    except Exception:
        pass  # metrics collection should never crash the app


def metrics_response():
    """Return the Prometheus metrics as (body, content_type)."""
    refresh_gauges()
    return generate_latest(), CONTENT_TYPE_LATEST
