# ─────────────────────────────────────────────────────────────────────────────
# IAM module variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name prefix for IAM role names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
}
