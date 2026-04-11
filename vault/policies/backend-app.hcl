# Policy: backend-app
# Who uses it: M2 backend service

# Read AND write secrets (manager uploads via backend)
path "secret/data/app/backend/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# List and permanently delete (KV v2 needs this separate)
path "secret/metadata/app/backend/*" {
  capabilities = ["read", "list", "delete"]
}

# TTL deadline auto-revoke
path "sys/leases/revoke" {
  capabilities = ["update"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}