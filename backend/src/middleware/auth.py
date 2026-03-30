"""
Auth Middleware — JWT verification and role-based access decorators.
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request


def manager_required(fn):
    """Decorator: only users with role='manager' can access."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "manager":
            return jsonify({"error": "Manager access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


def employee_required(fn):
    """Decorator: only users with role='employee' can access."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "employee":
            return jsonify({"error": "Employee access required"}), 403
        return fn(*args, **kwargs)
    return wrapper
