# Policy: readonly
# Who uses it: M4 monitoring / Prometheus exporter

path "kv/data/monitoring/*" {
  capabilities = ["read"]
}

path "sys/health" {
  capabilities = ["read", "sudo"]
}

path "sys/metrics" {
  capabilities = ["read"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}
