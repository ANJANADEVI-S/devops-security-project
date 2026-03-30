"""
Employee Routes — View secrets, request access, and retrieve granted secrets.
All routes require employee role.
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from src.middleware.auth import employee_required
from src.database import get_db, dict_row, dict_rows
from src.services.vault_service import get_vault
from src.services.metrics_service import ACCESS_REQUESTS

employee_bp = Blueprint("employee", __name__, url_prefix="/api/employee")


# ──────────────────────────────────────────────
# GET /api/employee/secrets
# List available secrets (metadata only — no values)
# ──────────────────────────────────────────────
@employee_bp.route("/secrets", methods=["GET"])
@employee_required
def list_secrets():
    """List all secrets the employee can request access to."""
    conn = get_db()
    rows = dict_rows(
        conn.execute(
            "SELECT id, name, description, ttl_hours, created_at FROM secrets ORDER BY name"
        ).fetchall()
    )
    conn.close()
    return jsonify({"secrets": rows}), 200


# ──────────────────────────────────────────────
# POST /api/employee/request
# Request access to a secret
# ──────────────────────────────────────────────
@employee_bp.route("/request", methods=["POST"])
@employee_required
def request_access():
    """Submit a request to access a specific secret."""
    data = request.get_json() or {}
    secret_id = data.get("secret_id")
    reason = data.get("reason", "").strip()

    if not secret_id:
        return jsonify({"error": "secret_id is required"}), 400

    employee_id = get_jwt_identity()

    conn = get_db()

    # Verify secret exists
    secret = dict_row(
        conn.execute("SELECT id, name FROM secrets WHERE id = ?", (secret_id,)).fetchone()
    )
    if not secret:
        conn.close()
        return jsonify({"error": "Secret not found"}), 404

    # Check for existing pending request
    existing = conn.execute(
        """SELECT id FROM access_requests
           WHERE employee_id = ? AND secret_id = ? AND status = 'pending'""",
        (employee_id, secret_id),
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "You already have a pending request for this secret"}), 409

    # Check for existing active grant
    active_grant = conn.execute(
        """SELECT id FROM access_grants
           WHERE employee_id = ? AND secret_id = ? AND status = 'active'""",
        (employee_id, secret_id),
    ).fetchone()
    if active_grant:
        conn.close()
        return jsonify({"error": "You already have active access to this secret"}), 409

    cursor = conn.execute(
        """INSERT INTO access_requests (employee_id, secret_id, reason)
           VALUES (?, ?, ?)""",
        (employee_id, secret_id, reason),
    )
    req_id = cursor.lastrowid
    conn.commit()
    conn.close()

    ACCESS_REQUESTS.labels(status="pending").inc()

    return jsonify({
        "message": f"Access request for '{secret['name']}' submitted — awaiting manager approval",
        "request_id": req_id,
    }), 201


# ──────────────────────────────────────────────
# GET /api/employee/requests
# View my requests
# ──────────────────────────────────────────────
@employee_bp.route("/requests", methods=["GET"])
@employee_required
def my_requests():
    """View all of my access requests."""
    employee_id = get_jwt_identity()

    conn = get_db()
    rows = dict_rows(
        conn.execute(
            """SELECT ar.*, s.name as secret_name
               FROM access_requests ar
               JOIN secrets s ON s.id = ar.secret_id
               WHERE ar.employee_id = ?
               ORDER BY ar.created_at DESC""",
            (employee_id,),
        ).fetchall()
    )
    conn.close()
    return jsonify({"requests": rows}), 200


# ──────────────────────────────────────────────
# GET /api/employee/grants
# View my active grants
# ──────────────────────────────────────────────
@employee_bp.route("/grants", methods=["GET"])
@employee_required
def my_grants():
    """View all of my access grants."""
    employee_id = get_jwt_identity()

    conn = get_db()
    rows = dict_rows(
        conn.execute(
            """SELECT ag.*, s.name as secret_name
               FROM access_grants ag
               JOIN secrets s ON s.id = ag.secret_id
               WHERE ag.employee_id = ?
               ORDER BY ag.granted_at DESC""",
            (employee_id,),
        ).fetchall()
    )
    conn.close()
    return jsonify({"grants": rows}), 200


# ──────────────────────────────────────────────
# GET /api/employee/grants/<id>/value
# Retrieve the actual secret value (only if grant is active)
# ──────────────────────────────────────────────
@employee_bp.route("/grants/<int:grant_id>/value", methods=["GET"])
@employee_required
def get_secret_value(grant_id):
    """Retrieve the actual secret value if grant is active and not expired."""
    employee_id = get_jwt_identity()

    conn = get_db()
    grant = dict_row(
        conn.execute(
            """SELECT ag.*, s.vault_path, s.name as secret_name
               FROM access_grants ag
               JOIN secrets s ON s.id = ag.secret_id
               WHERE ag.id = ? AND ag.employee_id = ?""",
            (grant_id, employee_id),
        ).fetchone()
    )
    conn.close()

    if not grant:
        return jsonify({"error": "Grant not found"}), 404

    if grant["status"] != "active":
        return jsonify({
            "error": f"Access has been {grant['status']}. Request a new access if needed.",
        }), 403

    # Check if deadline has passed (real-time check)
    now = datetime.utcnow()
    deadline = datetime.strptime(grant["deadline"], "%Y-%m-%d %H:%M:%S")
    if now > deadline:
        # Mark as expired immediately
        conn = get_db()
        conn.execute(
            "UPDATE access_grants SET status = 'expired', revoked_at = ? WHERE id = ?",
            (now.strftime("%Y-%m-%d %H:%M:%S"), grant_id),
        )
        conn.commit()
        conn.close()
        return jsonify({"error": "Access has expired. Request a new access."}), 403

    # Fetch from Vault
    vault = get_vault()
    secret_data = vault.read_secret(grant["vault_path"])

    if secret_data is None:
        return jsonify({"error": "Secret not found in vault"}), 404

    return jsonify({
        "secret_name": grant["secret_name"],
        "value": secret_data.get("value", secret_data),
        "deadline": grant["deadline"],
        "remaining_hours": round((deadline - now).total_seconds() / 3600, 2),
    }), 200
