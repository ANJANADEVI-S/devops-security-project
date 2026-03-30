# ================================================
# VAULT HANDOVER DOCUMENT
# Member 3 - Vault and Secrets
# DevOps Security Project
# ================================================

## Vault Server Details
URL:     http://10.10.166.53:8200
Version: v1.21.4
UI:      http://10.10.166.53:8200/ui

## For M2 (Backend) - Read Carefully

### Step 1 - Your Vault Credentials
Vault URL:  http://10.10.166.53:8200
Role ID:    a1497870-3244-1df9-748a-419ccb8b9500
Secret ID:  Ask M3 to generate one when you are ready to start coding
            (Secret ID expires every 24 hours so get a fresh one each time)

### Step 2 - How to Login to Vault
Run this in your terminal:
vault write auth/approle/login \
  role_id=a1497870-3244-1df9-748a-419ccb8b9500 \
  secret_id=YOUR_SECRET_ID

This gives you back a token. Use that token for all Vault requests.

### Step 3 - Your Secret Paths
These are the only paths your token can access:

secret/app/backend/database  - DB host, port, username, password
secret/app/backend/jwt       - JWT signing key, expiry, algorithm
secret/app/backend/api-keys  - Stripe key, SendGrid key

### Step 4 - How to Read a Secret
Using Vault CLI:
vault kv get secret/app/backend/database

Using HTTP API (in your code):
GET http://10.10.166.53:8200/v1/secret/data/app/backend/database
Header: X-Vault-Token: YOUR_TOKEN

### Step 5 - Code Example (Node.js)
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: 'http://10.10.166.53:8200'
});

await vault.approleLogin({
  role_id: 'a1497870-3244-1df9-748a-419ccb8b9500',
  secret_id: 'YOUR_SECRET_ID'
});

const secret = await vault.read('secret/data/app/backend/database');
console.log(secret.data.data.password);

### Step 6 - Code Example (Python)
import hvac

client = hvac.Client(url='http://10.10.166.53:8200')
client.auth.approle.login(
  role_id='a1497870-3244-1df9-748a-419ccb8b9500',
  secret_id='YOUR_SECRET_ID'
)

secret = client.secrets.kv.read_secret_version(
  path='app/backend/database'
)
print(secret['data']['data']['password'])

### Step 7 - When Your Token Expires (403 Error)
If you get a 403 error:
1. Ask M3 for a fresh Secret ID
2. Login again via AppRole
3. Retry your request

### Important Notes for M2
- Never hardcode Secret ID in your code
- Store Secret ID as environment variable
- Token lasts 1 hour then auto expires
- You can only access paths under secret/app/backend/
- You cannot access secret/app/frontend/ or secret/app/monitoring/

## For M5 (DevOps)
Docker image:  hashicorp/vault:latest

Required volume mounts:
  vault/data:/vault/data
  vault/config:/vault/config
  vault/logs:/vault/logs

Environment variables:
  VAULT_ADDR=http://vault:8200

Ports to expose:
  8200 - API and UI
  8201 - cluster communication

After container restart unseal with 3 keys from vault-init.json:
  vault operator unseal KEY1
  vault operator unseal KEY2
  vault operator unseal KEY3

## For M4 (Monitoring)
Prometheus metrics: http://10.10.166.53:8200/v1/sys/metrics?format=prometheus
Vault health:       http://10.10.166.53:8200/v1/sys/health
Audit log:          vault/logs/audit.log
Role ID:            Ask M3 to generate when ready

## Important Security Rules
1. Never commit vault-init.json to GitHub
2. Never share root token with anyone
3. Role ID is safe to share in group chat
4. Secret ID must be shared privately only
5. All access auto expires based on TTL
6. Audit logs record every single access
