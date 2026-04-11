path "sys/metrics" {
  capabilities = ["read", "sudo"]
}
path "sys/health" {
  capabilities = ["read", "sudo"]
}

# Fixed: was kv/data/monitoring/*, your mount is "secret"
path "secret/data/monitoring/*" {
  capabilities = ["read"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}