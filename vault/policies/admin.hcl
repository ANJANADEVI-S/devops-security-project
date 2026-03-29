@"
# Policy: admin
# Who uses it: project admins only

path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

path "sys/policies/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sys/leases/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
"@ | Out-File -FilePath vault\policies\admin.hcl -Encoding utf8