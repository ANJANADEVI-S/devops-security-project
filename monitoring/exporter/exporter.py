import json, time, os
from prometheus_client import start_http_server, Counter, Gauge

secrets_created  = Counter('vault_secrets_created_total', 'Total secrets created')
secrets_revoked  = Counter('vault_secrets_revoked_total', 'Total secrets revoked')
active_users     = Gauge('vault_active_users', 'Distinct active users')
requests_total   = Counter('vault_requests_total', 'Total Vault requests', ['method', 'path'])

LOG_PATH      = os.getenv('VAULT_AUDIT_LOG', 'C:/vault-exporter/audit.log')
last_position = 0

def parse_log():
    global last_position
    seen_users = set()
    try:
        with open(LOG_PATH, 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                user = entry.get('auth', {}).get('display_name')
                if user:
                    seen_users.add(user)
        active_users.set(len(seen_users))

        with open(LOG_PATH, 'r') as f:
            f.seek(last_position)
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                path   = entry.get('request', {}).get('path', '')
                method = entry.get('request', {}).get('operation', '')
                requests_total.labels(method=method, path=path).inc()
                if method in ('create', 'update') and 'secret' in path:
                    secrets_created.inc()
                if 'revoke' in path or method == 'delete':
                    secrets_revoked.inc()
            last_position = f.tell()

    except FileNotFoundError:
        print(f"Waiting for log at {LOG_PATH} ...")

if __name__ == '__main__':
    start_http_server(9100)
    print("Exporter running → http://localhost:9100/metrics")
    while True:
        parse_log()
        time.sleep(15)