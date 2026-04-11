storage "raft" {
  path    = "/vault/data"        # Linux path inside container
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

api_addr     = "http://vault:8200"    # Docker service name
cluster_addr = "http://vault:8201"

ui                = true
default_lease_ttl = "1h"
max_lease_ttl     = "24h"