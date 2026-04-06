storage "raft" {
  path    = "C:/Users/ANJANA/devops-security-project/vault/data"
  node_id = "vault-node-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname           = true
}
/*
api_addr          = "http://10.10.166.53:8200"
cluster_addr      = "http://10.10.166.53:8201"
*/
api_addr          = "http://127.0.0.1:8200"
cluster_addr      = "http://127.0.0.1:8201"

ui                = true
default_lease_ttl = "1h"
max_lease_ttl     = "24h"