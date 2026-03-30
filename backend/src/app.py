"""
Flask Application Factory — assembles all components.
"""

import os
import logging
from datetime import timedelta
from flask import Flask, Response
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from src.database import init_db
from src.services.metrics_service import metrics_response, HTTP_REQUESTS


def create_app():
    """Create and configure the Flask application."""

    app = Flask(__name__)

    # ── Configuration ─────────────────────────────
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=6)
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    # ── Extensions ────────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    # ── Logging ───────────────────────────────────
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    # ── Initialise Database ───────────────────────
    init_db()

    # ── Register Blueprints (Routes) ──────────────
    from src.routes.auth_routes import auth_bp
    from src.routes.manager_routes import manager_bp
    from src.routes.employee_routes import employee_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(manager_bp)
    app.register_blueprint(employee_bp)

    # ── Prometheus /metrics endpoint ──────────────
    @app.route("/metrics")
    def metrics():
        body, content_type = metrics_response()
        return Response(body, mimetype=content_type)

    # ── Health check ──────────────────────────────
    @app.route("/health")
    def health():
        return {"status": "healthy", "service": "devops-security-backend"}, 200

    # ── Root route (API info) ─────────────────────
    @app.route("/")
    def index():
        mock = os.getenv("VAULT_MOCK_MODE", "true").lower() == "true"
        return {
            "service": "DevOps Security Backend",
            "version": "1.0.0",
            "status": "running",
            "vault_mode": "MOCK (in-memory)" if mock else "REAL (HashiCorp Vault connected)",
            "endpoints": {
                "auth": {
                    "POST /api/auth/login": "Login (returns JWT)",
                    "POST /api/auth/register": "Register user (manager only)",
                    "GET /api/auth/me": "Get profile",
                },
                "manager": {
                    "POST /api/manager/employees": "Add employees",
                    "GET /api/manager/employees": "List employees",
                    "DELETE /api/manager/employees/<id>": "Remove employee",
                    "POST /api/manager/secrets": "Upload secret to Vault",
                    "GET /api/manager/secrets": "List secrets",
                    "DELETE /api/manager/secrets/<id>": "Delete secret",
                    "GET /api/manager/requests": "View access requests",
                    "PUT /api/manager/requests/<id>/approve": "Approve request",
                    "PUT /api/manager/requests/<id>/reject": "Reject request",
                    "GET /api/manager/vault-data": "Vault overview",
                },
                "employee": {
                    "GET /api/employee/secrets": "List available secrets",
                    "POST /api/employee/request": "Request secret access",
                    "GET /api/employee/requests": "View my requests",
                    "GET /api/employee/grants": "View my grants",
                    "GET /api/employee/grants/<id>/value": "Get secret value",
                },
                "system": {
                    "GET /health": "Health check",
                    "GET /metrics": "Prometheus metrics",
                },
            },
        }, 200

    # ── Request counter middleware ─────────────────
    @app.after_request
    def count_requests(response):
        try:
            HTTP_REQUESTS.labels(
                method=response.__class__.__name__,  # will be overridden
                endpoint=str(getattr(response, 'status_code', 0)),
                status=str(response.status_code),
            ).inc()
        except Exception:
            pass
        return response

    # ── Start deadline scheduler ──────────────────
    from src.services.deadline_service import start_deadline_scheduler
    start_deadline_scheduler()

    logger.info("=" * 50)
    logger.info("  DevOps Security Backend — READY")
    logger.info(f"  Mock Vault: {os.getenv('VAULT_MOCK_MODE', 'true')}")
    logger.info("=" * 50)

    return app
