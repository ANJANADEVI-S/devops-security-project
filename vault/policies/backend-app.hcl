@"
# Policy: backend-app
# Who uses it: M2 backend service
# Access: read secrets, get dynamic DB creds

path "secret/data/app/backend/*" {
  capabilities = ["read"]
}

path "database/creds/backend-role" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}
"@ | Out-File -FilePath vault\policies\backend-app.hcl -Encoding utf8