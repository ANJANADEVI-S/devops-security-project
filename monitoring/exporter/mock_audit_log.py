import json, time, random
from datetime import datetime

LOG_PATH = "C:/vault-exporter/audit.log"

users = ["alice", "bob", "charlie", "diana", "manager1"]
paths = [
    "secret/data/db-password",
    "secret/data/api-key",
    "secret/data/ssh-key",
    "sys/leases/revoke",
    "auth/token/create",
]
operations = ["read", "create", "update", "delete"]

def write_entry(path, operation, user):
    entry = {
        "time": datetime.utcnow().isoformat() + "Z",
        "type": "request",
        "request": {"path": path, "operation": operation},
        "auth": {"display_name": user, "entity_id": f"entity-{user}"}
    }
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

if __name__ == "__main__":
    import os
    os.makedirs("C:/vault-exporter", exist_ok=True)
    print(f"Writing mock audit log to {LOG_PATH}")
    for _ in range(30):          # seed 30 initial entries
        write_entry(random.choice(paths), random.choice(operations), random.choice(users))
    while True:                  # keep adding live entries
        write_entry(random.choice(paths), random.choice(operations), random.choice(users))
        time.sleep(random.uniform(2, 6))