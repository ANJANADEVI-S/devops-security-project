path "sys/metrics" {
  capabilities = ["read", "sudo"]
}
path "sys/health" {
  capabilities = ["read", "sudo"]
}
path "kv/data/monitoring/*" {
  capabilities = ["read"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
