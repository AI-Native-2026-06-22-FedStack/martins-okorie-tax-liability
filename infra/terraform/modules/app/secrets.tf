# ─────────────────────────────────────────────────────────────────────────────
# App module — Secrets definitions
#
# Wires AWS Secrets Manager ARNs into container definitions using valueFrom.
# The actual secret values are fetched at runtime by the execution role and
# NEVER stored in Terraform code or state.
# ─────────────────────────────────────────────────────────────────────────────

locals {
  # Core Case Service runtime secrets injected into container environment
  api_container_secrets = [
    {
      name      = "DB_PASSWORD"
      valueFrom = var.db_password_secret_arn
    },
    {
      name      = "JWT_SIGNING_KEYS"
      valueFrom = var.jwt_signing_keys_secret_arn
    }
  ]

  # Tax Engine runtime secrets injected into container environment
  compute_container_secrets = [
    {
      name      = "DB_PASSWORD"
      valueFrom = var.db_password_secret_arn
    }
  ]
}
