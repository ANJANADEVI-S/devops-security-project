"""
Manager Routes — Employee management, secret uploads, and request approval.
All routes require manager role.
"""

import bcrypt
from datetime import datetime, timedelta
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, get_jwt
from src.middleware.auth import manager_required
from src.database import get_db, dict_row, dict_rows
from src.services.vault_service import get_vault, generate_password
from src.services.metrics_service import ACCESS_REQUESTS

manager_bp = Blueprint("manager", __name__, url_prefix="/api/manager")

DEFAULT_DEADLINE_HOURS = int(os.getenv("DEFAULT_DEADLINE_HOURS", "24"))


# ══════════════════════════════════════════════
#  EMPLOYEE MANAGEMENT
# ══════════════════════════════════════════════

@manager_bp.route("/employees", methods=["POST"])
@manager_required
def add_employee():
    """Add a new employee (bulk or single)."""
    data = request.get_json() or {}

    # Support both single object and list
    employees = data.get("employees", [data]) if "employees" in data else [data]

    conn = get_db()
    created = []

    for emp in employees:
        email = emp.get("email", "").strip().lower()
        password = emp.get("password", "defaultPass123")
        full_name = emp.get("full_name", "").strip()
        department = emp.get("department", "").strip()

        if not email or not full_name:
            continue

        # Skip if already exists
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            continue

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        cursor = conn.execute(
            """INSERT INTO users (email, password_hash, full_name, role, department)
               VALUES (?, ?, ?, 'employee', ?)""",
            (email, password_hash, full_name, department),
        )
        created.append({
            "id": cursor.lastrowid,
            "email": email,
            "full_name": full_name,
            "department": department,
        })

    conn.commit()
    conn.close()

    return jsonify({
        "message": f"{len(created)} employee(s) added",
        "employees": created,
    }), 201


@manager_bp.route("/employees", methods=["GET"])
@manager_required
def list_employees():
    """List all employees."""
    conn = get_db()
    rows = dict_rows(
        conn.execute(
            "SELECT id, email, full_name, role, department, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    )
    conn.close()
    return jsonify({"employees": rows}), 200


@manager_bp.route("/employees/<int:emp_id>", methods=["DELETE"])
@manager_required
def delete_employee(emp_id):
    """Remove an employee."""
    conn = get_db()
    user = dict_row(
        conn.execute("SELECT id, role FROM users WHERE id = ?", (emp_id,)).fetchone()
    )

    if not user:
        conn.close()
        return jsonify({"error": "Employee not found"}), 404

    if user["role"] == "manager":
        conn.close()
        return jsonify({"error": "Cannot delete a manager account"}), 403

    conn.execute("DELETE FROM access_grants WHERE employee_id = ?", (emp_id,))
    conn.execute("DELETE FROM access_requests WHERE employee_id = ?", (emp_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (emp_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Employee removed successfully"}), 200


# ══════════════════════════════════════════════
#  SECRET MANAGEMENT
# ══════════════════════════════════════════════

@manager_bp.route("/secrets", methods=["POST"])
@manager_required
def upload_secret():
    """Upload a new secret to Vault."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    description = data.get("description", "")
    value = data.get("value", "")
    ttl_hours = data.get("ttl_hours", DEFAULT_DEADLINE_HOURS)

    if not name or not value:
        return jsonify({"error": "name and value are required"}), 400

    # Build vault path
    vault_path = f"app/secrets/{name.lower().replace(' ', '-')}"

    manager_id = get_jwt_identity()

    conn = get_db()

    # Check duplicate name
    existing = conn.execute(
        "SELECT id FROM secrets WHERE vault_path = ?", (vault_path,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": f"Secret '{name}' already exists"}), 409

    # Write to Vault (encrypted at rest by Vault)
    vault = get_vault()
    vault.write_secret(vault_path, {
        "value": value,
        "created_by": manager_id,
        "created_at": datetime.utcnow().isoformat(),
    })

    # Save metadata in SQLite
    cursor = conn.execute(
        """INSERT INTO secrets (name, description, vault_path, created_by, ttl_hours)
           VALUES (?, ?, ?, ?, ?)""",
        (name, description, vault_path, manager_id, ttl_hours),
    )
    secret_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "message": f"Secret '{name}' stored successfully (encrypted in Vault)",
        "secret": {
            "id": secret_id,
            "name": name,
            "vault_path": vault_path,
            "ttl_hours": ttl_hours,
        },
    }), 201


@manager_bp.route("/secrets", methods=["GET"])
@manager_required
def list_secrets():
    """List all secrets (metadata only — no values)."""
    conn = get_db()
    rows = dict_rows(
        conn.execute(
            """SELECT s.id, s.name, s.description, s.vault_path, s.ttl_hours, s.created_at,
                      u.full_name as created_by_name
               FROM secrets s
               JOIN users u ON u.id = s.created_by
               ORDER BY s.created_at DESC"""
        ).fetchall()
    )
    conn.close()
    return jsonify({"secrets": rows}), 200


@manager_bp.route("/secrets/<int:secret_id>", methods=["DELETE"])
@manager_required
def delete_secret(secret_id):
    """Delete a secret from Vault and database."""
    conn = get_db()
    secret = dict_row(
        conn.execute("SELECT * FROM secrets WHERE id = ?", (secret_id,)).fetchone()
    )

    if not secret:
        conn.close()
        return jsonify({"error": "Secret not found"}), 404

    # Delete from Vault
    vault = get_vault()
    vault.delete_secret(secret["vault_path"])

    # Delete from DB (and related grants/requests)
    conn.execute("DELETE FROM access_grants WHERE secret_id = ?", (secret_id,))
    conn.execute("DELETE FROM access_requests WHERE secret_id = ?", (secret_id,))
    conn.execute("DELETE FROM secrets WHERE id = ?", (secret_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": f"Secret '{secret['name']}' deleted"}), 200


# ══════════════════════════════════════════════
#  REQUEST APPROVAL WORKFLOW
# ══════════════════════════════════════════════

@manager_bp.route("/requests", methods=["GET"])
@manager_required
def list_requests():
    """List all access requests (optionally filter by status)."""
    status_filter = request.args.get("status", None)

    conn = get_db()
    if status_filter:
        rows = dict_rows(
            conn.execute(
                """SELECT ar.*, u.full_name as employee_name, u.email as employee_email,
                          s.name as secret_name
                   FROM access_requests ar
                   JOIN users u ON u.id = ar.employee_id
                   JOIN secrets s ON s.id = ar.secret_id
                   WHERE ar.status = ?
                   ORDER BY ar.created_at DESC""",
                (status_filter,),
            ).fetchall()
        )
    else:
        rows = dict_rows(
            conn.execute(
                """SELECT ar.*, u.full_name as employee_name, u.email as employee_email,
                          s.name as secret_name
                   FROM access_requests ar
                   JOIN users u ON u.id = ar.employee_id
                   JOIN secrets s ON s.id = ar.secret_id
                   ORDER BY ar.created_at DESC"""
            ).fetchall()
        )
    conn.close()
    return jsonify({"requests": rows}), 200


@manager_bp.route("/requests/<int:req_id>/approve", methods=["PUT"])
@manager_required
def approve_request(req_id):
    """Approve a secret access request and set a deadline."""
    data = request.get_json() or {}
    deadline_hours = data.get("deadline_hours", DEFAULT_DEADLINE_HOURS)
    manager_id = get_jwt_identity()

    conn = get_db()
    req = dict_row(
        conn.execute("SELECT * FROM access_requests WHERE id = ?", (req_id,)).fetchone()
    )

    if not req:
        conn.close()
        return jsonify({"error": "Request not found"}), 404

    if req["status"] != "pending":
        conn.close()
        return jsonify({"error": f"Request is already '{req['status']}'"}), 400

    now = datetime.utcnow()
    deadline = now + timedelta(hours=deadline_hours)
    deadline_str = deadline.strftime("%Y-%m-%d %H:%M:%S")
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # Update request status
    conn.execute(
        """UPDATE access_requests
           SET status = 'approved', approved_by = ?, deadline = ?, updated_at = ?
           WHERE id = ?""",
        (manager_id, deadline_str, now_str, req_id),
    )

    # Create access grant
    conn.execute(
        """INSERT INTO access_grants (request_id, employee_id, secret_id, deadline)
           VALUES (?, ?, ?, ?)""",
        (req_id, req["employee_id"], req["secret_id"], deadline_str),
    )

    conn.commit()
    conn.close()

    ACCESS_REQUESTS.labels(status="approved").inc()

    return jsonify({
        "message": "Request approved",
        "deadline": deadline_str,
        "deadline_hours": deadline_hours,
    }), 200


@manager_bp.route("/requests/<int:req_id>/reject", methods=["PUT"])
@manager_required
def reject_request(req_id):
    """Reject a secret access request."""
    manager_id = get_jwt_identity()

    conn = get_db()
    req = dict_row(
        conn.execute("SELECT * FROM access_requests WHERE id = ?", (req_id,)).fetchone()
    )

    if not req:
        conn.close()
        return jsonify({"error": "Request not found"}), 404

    if req["status"] != "pending":
        conn.close()
        return jsonify({"error": f"Request is already '{req['status']}'"}), 400

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    conn.execute(
        """UPDATE access_requests
           SET status = 'rejected', approved_by = ?, updated_at = ?
           WHERE id = ?""",
        (manager_id, now_str, req_id),
    )
    conn.commit()
    conn.close()

    ACCESS_REQUESTS.labels(status="rejected").inc()

    return jsonify({"message": "Request rejected"}), 200


# ══════════════════════════════════════════════
#  VAULT DATA OVERVIEW
# ══════════════════════════════════════════════

@manager_bp.route("/vault-data", methods=["GET"])
@manager_required
def vault_data():
    """Overview of all vault data — secrets, grants, and stats."""
    conn = get_db()

    secrets = dict_rows(
        conn.execute(
            """SELECT s.*, u.full_name as created_by_name
               FROM secrets s JOIN users u ON u.id = s.created_by"""
        ).fetchall()
    )

    active_grants = dict_rows(
        conn.execute(
            """SELECT ag.*, u.full_name as employee_name, s.name as secret_name
               FROM access_grants ag
               JOIN users u ON u.id = ag.employee_id
               JOIN secrets s ON s.id = ag.secret_id
               WHERE ag.status = 'active'
               ORDER BY ag.deadline ASC"""
        ).fetchall()
    )

    stats = {
        "total_users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        "total_managers": conn.execute("SELECT COUNT(*) FROM users WHERE role='manager'").fetchone()[0],
        "total_employees": conn.execute("SELECT COUNT(*) FROM users WHERE role='employee'").fetchone()[0],
        "total_secrets": conn.execute("SELECT COUNT(*) FROM secrets").fetchone()[0],
        "pending_requests": conn.execute("SELECT COUNT(*) FROM access_requests WHERE status='pending'").fetchone()[0],
        "active_grants": conn.execute("SELECT COUNT(*) FROM access_grants WHERE status='active'").fetchone()[0],
        "expired_grants": conn.execute("SELECT COUNT(*) FROM access_grants WHERE status='expired'").fetchone()[0],
    }

    conn.close()

    return jsonify({
        "secrets": secrets,
        "active_grants": active_grants,
        "stats": stats,
    }), 200
