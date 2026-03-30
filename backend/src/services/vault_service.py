"""
Vault Service — Handles all communication with HashiCorp Vault.
Supports a MOCK MODE for development without a running Vault instance.
"""

import os
import string
import secrets as py_secrets
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mock Vault (in-memory) for development
# ---------------------------------------------------------------------------

class MockVault:
    """In-memory mock that mimics Vault KV v2 operations."""

    def __init__(self):
        self._store = {}
        logger.info("[VAULT-MOCK] Mock Vault initialised (in-memory store)")

    def read_secret(self, path):
        data = self._store.get(path)
        if data is None:
            return None
        return data

    def write_secret(self, path, data):
        self._store[path] = data
        logger.info(f"[VAULT-MOCK] Secret written at '{path}'")

    def delete_secret(self, path):
        if path in self._store:
            del self._store[path]
            logger.info(f"[VAULT-MOCK] Secret deleted at '{path}'")
            return True
        return False

    def list_secrets(self, path):
        prefix = path.rstrip("/") + "/"
        keys = [k[len(prefix):] for k in self._store if k.startswith(prefix)]
        return keys


# ---------------------------------------------------------------------------
# Real Vault client (uses hvac)
# ---------------------------------------------------------------------------

class RealVault:
    """Wraps the hvac client for AppRole-based Vault access."""

    def __init__(self):
        try:
            import hvac
        except ImportError:
            raise RuntimeError("hvac package is required for real Vault mode. pip install hvac")

        self.addr = os.getenv("VAULT_ADDR", "http://127.0.0.1:8200")
        self.role_id = os.getenv("VAULT_ROLE_ID", "")
        self.secret_id = os.getenv("VAULT_SECRET_ID", "")
        self.client = hvac.Client(url=self.addr)
        self._login()

    def _login(self):
        """Authenticate via AppRole and store the token."""
        try:
            result = self.client.auth.approle.login(
                role_id=self.role_id,
                secret_id=self.secret_id,
            )
            self.client.token = result["auth"]["client_token"]
            logger.info("[VAULT] AppRole login successful")
        except Exception as e:
            logger.error(f"[VAULT] AppRole login failed: {e}")
            raise

    def _ensure_auth(self):
        """Re-authenticate if token is invalid."""
        if not self.client.is_authenticated():
            logger.warning("[VAULT] Token expired — re-authenticating")
            self._login()

    def read_secret(self, path):
        self._ensure_auth()
        try:
            resp = self.client.secrets.kv.v2.read_secret_version(path=path)
            return resp["data"]["data"]
        except Exception as e:
            logger.error(f"[VAULT] Read failed for '{path}': {e}")
            return None

    def write_secret(self, path, data):
        self._ensure_auth()
        try:
            self.client.secrets.kv.v2.create_or_update_secret(path=path, secret=data)
            logger.info(f"[VAULT] Secret written at '{path}'")
        except Exception as e:
            logger.error(f"[VAULT] Write failed for '{path}': {e}")
            raise

    def delete_secret(self, path):
        self._ensure_auth()
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(path=path)
            logger.info(f"[VAULT] Secret deleted at '{path}'")
            return True
        except Exception as e:
            logger.error(f"[VAULT] Delete failed for '{path}': {e}")
            return False

    def list_secrets(self, path):
        self._ensure_auth()
        try:
            resp = self.client.secrets.kv.v2.list_secrets(path=path)
            return resp["data"]["keys"]
        except Exception as e:
            logger.error(f"[VAULT] List failed for '{path}': {e}")
            return []


# ---------------------------------------------------------------------------
# Public singleton
# ---------------------------------------------------------------------------

_vault_instance = None


def get_vault():
    """Return the vault client singleton (mock or real based on env)."""
    global _vault_instance
    if _vault_instance is None:
        mock_mode = os.getenv("VAULT_MOCK_MODE", "true").lower() == "true"
        if mock_mode:
            _vault_instance = MockVault()
        else:
            _vault_instance = RealVault()
    return _vault_instance


def generate_password(length=20):
    """Generate a cryptographically strong random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(py_secrets.choice(alphabet) for _ in range(length))
