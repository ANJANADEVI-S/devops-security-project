"""
Database module — SQLite initialization and helper functions.
Creates all tables on first import.
"""

import sqlite3
import os

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DB_PATH = os.path.join(DB_DIR, 'app.db')


def get_db():
    """Get a new database connection with row factory enabled."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # access columns by name
    conn.execute("PRAGMA journal_mode=WAL")  # better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def dict_row(row):
    """Convert a sqlite3.Row to a plain dict."""
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    """Convert a list of sqlite3.Row to a list of dicts."""
    return [dict(r) for r in rows]


def init_db():
    """Create all tables if they don't exist."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        -- =====================
        -- Users table
        -- =====================
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            email       TEXT    NOT NULL UNIQUE,
            password_hash TEXT  NOT NULL,
            full_name   TEXT    NOT NULL,
            role        TEXT    NOT NULL CHECK(role IN ('manager', 'employee')),
            department  TEXT    DEFAULT '',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- =====================
        -- Secrets metadata table
        -- (actual secret values live in Vault)
        -- =====================
        CREATE TABLE IF NOT EXISTS secrets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            vault_path  TEXT    NOT NULL UNIQUE,
            created_by  INTEGER NOT NULL,
            ttl_hours   INTEGER DEFAULT 24,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        -- =====================
        -- Access requests from employees
        -- =====================
        CREATE TABLE IF NOT EXISTS access_requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            secret_id   INTEGER NOT NULL,
            reason      TEXT    DEFAULT '',
            status      TEXT    NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','approved','rejected','expired')),
            approved_by INTEGER,
            deadline    TIMESTAMP,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES users(id),
            FOREIGN KEY (secret_id)   REFERENCES secrets(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
        );

        -- =====================
        -- Active access grants
        -- =====================
        CREATE TABLE IF NOT EXISTS access_grants (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id  INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            secret_id   INTEGER NOT NULL,
            granted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deadline    TIMESTAMP NOT NULL,
            revoked_at  TIMESTAMP,
            status      TEXT    NOT NULL DEFAULT 'active'
                        CHECK(status IN ('active','expired','revoked')),
            FOREIGN KEY (request_id)  REFERENCES access_requests(id),
            FOREIGN KEY (employee_id) REFERENCES users(id),
            FOREIGN KEY (secret_id)   REFERENCES secrets(id)
        );
    """)

    conn.commit()
    conn.close()
    print("[DB] All tables initialised successfully.")
