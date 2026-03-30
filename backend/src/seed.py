"""
Seed script — creates a default manager account for testing.
Run:  python -m src.seed
"""

import bcrypt
from src.database import get_db, init_db


def seed():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Check if manager already exists
    existing = cursor.execute(
        "SELECT id FROM users WHERE email = ?", ("admin@company.com",)
    ).fetchone()

    if existing:
        print("[SEED] Default manager already exists — skipping.")
        conn.close()
        return

    password_hash = bcrypt.hashpw(
        "admin123".encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    cursor.execute(
        """INSERT INTO users (email, password_hash, full_name, role, department)
           VALUES (?, ?, ?, ?, ?)""",
        ("admin@company.com", password_hash, "Admin Manager", "manager", "Management"),
    )
    conn.commit()
    conn.close()
    print("[SEED] Default manager created: admin@company.com / admin123")


if __name__ == "__main__":
    seed()
