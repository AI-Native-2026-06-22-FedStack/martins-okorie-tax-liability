# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — Root module variables
# ─────────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the TaxPulse VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging."
  type        = string
  default     = "taxpulse"
}
