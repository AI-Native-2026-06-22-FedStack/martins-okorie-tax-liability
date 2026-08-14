# ─────────────────────────────────────────────────────────────────────────────
# Data module variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  type        = string
  description = "Project name prefix applied to all resources."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, test, prod)."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where data resources are deployed."
}

variable "db_subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for RDS database subnet group (private DB tier)."
}

variable "db_security_group_id" {
  type        = string
  description = "Security group ID allowing database and cache ingress."
}
