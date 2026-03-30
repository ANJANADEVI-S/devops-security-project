"""
Auth Routes — Login, Register, and Profile endpoints.
"""

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from src.database import get_db, dict_row
from src.services.metrics_service import ACCESS_REQUESTS

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ──────────────────────────────────────────────
# POST /api/auth/login
# ──────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return a JWT."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db()
    user = dict_row(
        conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    )
    conn.close()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    # Create JWT with role in additional claims
    token = create_access_token(
        identity=str(user["id"]),
        additional_claims={
            "role": user["role"],
            "email": user["email"],
            "full_name": user["full_name"],
        },
    )

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user["department"],
        },
    }), 200


# ──────────────────────────────────────────────
# POST /api/auth/register
# Manager registers new employees (or other managers)
# ──────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
@jwt_required()
def register():
    """Register a new user (manager only)."""
    claims = get_jwt()
    if claims.get("role") != "manager":
        return jsonify({"error": "Only managers can register users"}), 403

    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    role = data.get("role", "employee").strip().lower()
    department = data.get("department", "").strip()

    # Validation
    if not email or not password or not full_name:
        return jsonify({"error": "email, password, and full_name are required"}), 400

    if role not in ("manager", "employee"):
        return jsonify({"error": "role must be 'manager' or 'employee'"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()

    # Check duplicate
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ?", (email,)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    cursor = conn.execute(
        """INSERT INTO users (email, password_hash, full_name, role, department)
           VALUES (?, ?, ?, ?, ?)""",
        (email, password_hash, full_name, role, department),
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "message": f"User '{full_name}' registered successfully",
        "user": {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role,
            "department": department,
        },
    }), 201


# ──────────────────────────────────────────────
# GET /api/auth/me
# ──────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Get current logged-in user's profile."""
    user_id = get_jwt_identity()
    conn = get_db()
    user = dict_row(
        conn.execute("SELECT id, email, full_name, role, department, created_at FROM users WHERE id = ?",
                      (user_id,)).fetchone()
    )
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"user": user}), 200
