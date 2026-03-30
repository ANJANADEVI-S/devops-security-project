"""
Deadline Service — Runs a background job that checks for expired access grants,
revokes them, and generates new passwords in Vault.
"""

import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from src.database import get_db
from src.services.vault_service import get_vault, generate_password
from src.services.metrics_service import SECRETS_REVOKED, SECRETS_GENERATED

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(daemon=True)


def check_expired_grants():
    """Find expired grants, revoke access, and regenerate secrets."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Find all active grants whose deadline has passed
        expired = cursor.execute(
            """SELECT ag.id, ag.secret_id, s.vault_path, s.name
               FROM access_grants ag
               JOIN secrets s ON s.id = ag.secret_id
               WHERE ag.status = 'active' AND ag.deadline <= ?""",
            (now,),
        ).fetchall()

        if not expired:
            conn.close()
            return

        vault = get_vault()

        for grant in expired:
            grant_id = grant[0]
            secret_id = grant[1]
            vault_path = grant[2]
            secret_name = grant[3]

            # 1. Mark grant as expired
            cursor.execute(
                """UPDATE access_grants
                   SET status = 'expired', revoked_at = ?
                   WHERE id = ?""",
                (now, grant_id),
            )

            # 2. Also update the access_request status
            cursor.execute(
                """UPDATE access_requests
                   SET status = 'expired', updated_at = ?
                   WHERE id = (SELECT request_id FROM access_grants WHERE id = ?)""",
                (now, grant_id),
            )

            # 3. Generate a new password and update in Vault
            new_password = generate_password()
            try:
                vault.write_secret(vault_path, {
                    "value": new_password,
                    "rotated_at": now,
                    "reason": "auto-revoked-deadline-expired",
                })
                SECRETS_GENERATED.inc()
                logger.info(
                    f"[DEADLINE] Secret '{secret_name}' rotated — grant {grant_id} expired"
                )
            except Exception as e:
                logger.error(f"[DEADLINE] Failed to rotate secret '{secret_name}': {e}")

            SECRETS_REVOKED.inc()

        conn.commit()
        conn.close()

        logger.info(f"[DEADLINE] Processed {len(expired)} expired grant(s)")

    except Exception as e:
        logger.error(f"[DEADLINE] Error checking grants: {e}")


def start_deadline_scheduler():
    """Start the background scheduler that checks every 60 seconds."""
    scheduler.add_job(
        check_expired_grants,
        "interval",
        seconds=60,
        id="deadline_checker",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[DEADLINE] Scheduler started — checking every 60 seconds")
