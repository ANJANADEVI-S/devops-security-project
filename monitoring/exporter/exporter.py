import json, time, os
from prometheus_client import start_http_server, Counter, Gauge

secrets_created  = Counter('vault_secrets_created_total', 'Total secrets created in Vault')
secrets_revoked  = Counter('vault_secrets_revoked_total', 'Total secrets revoked in Vault')
active_users     = Gauge('vault_active_users', 'Distinct active users seen in audit log')
requests_total   = Counter('vault_requests_total', 'Total Vault requests', ['operation', 'path'])

LOG_PATH      = os.getenv('VAULT_AUDIT_LOG', 'C:/vault-exporter/audit.log')
last_position = 0

def parse_log():
    global last_position
    seen_users = set()

    try:
        # Full scan to count active users
        with open(LOG_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                user = entry.get('auth', {}).get('display_name')
                if user:
                    seen_users.add(user)
        active_users.set(len(seen_users))

        # Only process NEW lines for counters
        with open(LOG_PATH, 'r', encoding='utf-8') as f:
            f.seek(last_position)
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Only count response entries to avoid double counting
                # (each action produces both a request + response entry)
                if entry.get('type') != 'response':
                    continue

                path      = entry.get('request', {}).get('path', '')
                operation = entry.get('request', {}).get('operation', '')

                if not path or not operation:
                    continue

                # Track all requests by operation + path
                requests_total.labels(operation=operation, path=path).inc()

                # Secret created — real Vault KV path is secret/data/...
                if operation == 'create' and 'secret/data/' in path:
                    secrets_created.inc()

                # Secret revoked — lease revocation or delete
                if 'revoke' in path or (operation == 'delete' and 'secret/' in path):
                    secrets_revoked.inc()

            last_position = f.tell()

    except FileNotFoundError:
        print(f"Waiting for log at {LOG_PATH} ...")
    except Exception as e:
        print(f"Error parsing log: {e}")

if __name__ == '__main__':
    start_http_server(9100)
    print(f"Exporter running → http://localhost:9100/metrics")
    print(f"Reading log from → {LOG_PATH}")
    while True:
        parse_log()
        time.sleep(15)