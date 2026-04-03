# Monitoring — Prometheus + Grafana

## What this folder contains
- **prometheus/** — Prometheus config. Vault scrape job is commented out pending M3 integration.
- **exporter/** — Custom Python exporter that reads Vault audit.log and exposes metrics on :9100
- **grafana/** — Dashboard JSON + provisioning config for auto-loading on startup

## Metrics exposed by exporter
| Metric | Type | Description |
|---|---|---|
| vault_secrets_created_total | Counter | Secrets created/updated |
| vault_secrets_revoked_total | Counter | Secrets revoked/deleted |
| vault_active_users | Gauge | Distinct users seen in log |
| vault_requests_total | Counter | All requests, labelled by method+path |

## Ports
| Service | Port |
|---|---|
| Prometheus | 9090 |
| Exporter | 9100 |
| Grafana | 3000 |

## Running locally (dev)
```bash
pip install -r exporter/requirements.txt

# Terminal 1 — mock log (dev only, remove on integration)
python exporter/mock_audit_log.py

# Terminal 2 — exporter
python exporter/exporter.py

# Terminal 3 — prometheus
./prometheus --config.file=prometheus/prometheus.yml
```

## For Member 3 (Vault)
Add this block to your config.hcl:
```hcl
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname           = true
}
```
Then uncomment the vault job in `prometheus/prometheus.yml` and fill in your host + token.

## For Member 5 (DevOps)
- Exporter runs on port 9100
- Prometheus config is in `prometheus/prometheus.yml`
- Grafana dashboard auto-provisions from `grafana/provisioning/`
- Environment variable `VAULT_AUDIT_LOG` must point to the vault audit log path
```

---

### Git hygiene tip

Add a `.gitignore` inside `monitoring/` so you don't accidentally commit the mock log file:
```
# monitoring/.gitignore
*.log
__pycache__/
*.pyc