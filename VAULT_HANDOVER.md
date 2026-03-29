# Vault Handover Document
# Member 3 - Vault and Secrets
# DevOps Security Project

## Vault Server Details
URL: http://127.0.0.1:8200
Version: v1.21.4
Storage: Raft (persistent)
UI: http://127.0.0.1:8200/ui

## For M2 (Backend)
Your Role: backend-service
Your Policy: backend-app
Token TTL: 1 hour (auto renew via AppRole)

Step 1 - Get your Role ID:
vault read auth/approle/role/backend-service/role-id

Step 2 - Get your Secret ID:
vault write -f auth/approle/role/backend-service/secret-id

Step 3 - Login:
vault write auth/approle/login role_id=YOUR_ROLE_ID secret_id=YOUR_SECRET_ID

Step 4 - Use the token returned to read secrets:

Secret Paths you can access:
- secret/app/backend/database  (DB credentials)
- secret/app/backend/jwt       (JWT signing key)
- secret/app/backend/api-keys  (external API keys)

API call example:
GET http://127.0.0.1:8200/v1/secret/data/app/backend/database
Header: X-Vault-Token: YOUR_TOKEN

When token expires (403 error):
- Catch the 403 in your code
- Login again via AppRole to get fresh token
- Retry the request

## For M4 (Monitoring)
Your Role: monitoring-service
Your Policy: readonly
Token TTL: 1 hour

Step 1 - Get your Role ID:
vault read auth/approle/role/monitoring-service/role-id

Step 2 - Get your Secret ID:
vault write -f auth/approle/role/monitoring-service/secret-id

Step 3 - Login:
vault write auth/approle/login role_id=YOUR_ROLE_ID secret_id=YOUR_SECRET_ID

Vault Metrics URL for Prometheus:
http://127.0.0.1:8200/v1/sys/metrics?format=prometheus

Vault Health URL:
http://127.0.0.1:8200/v1/sys/health

Audit Log Location:
C:\Users\ANJANA\devops-security-project\vault\logs\audit.log

## For M5 (DevOps)
Docker image: hashicorp/vault:latest

Required volume mounts:
- vault/data:/vault/data        (persistent storage)
- vault/config:/vault/config    (config file)
- vault/logs:/vault/logs        (audit logs for M4)

Environment variables needed:
- VAULT_ADDR=http://vault:8200

After container restart:
Vault starts sealed - unseal with 3 keys from vault-init.json:
vault operator unseal KEY1
vault operator unseal KEY2
vault operator unseal KEY3

Ports to expose:
- 8200 (API and UI)
- 8201 (cluster communication)

## Important Notes
1. Never commit vault-init.json to GitHub
2. Never share root token with anyone
3. Give M2 only their Role ID (not Secret ID)
4. Secret ID is generated fresh each deployment
5. All secrets auto expire based on TTL
6. Audit logs record every access
