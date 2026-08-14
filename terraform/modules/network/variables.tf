# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Network base module variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name for resource naming."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB placement)."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private app subnets (Fargate tasks)."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private DB subnets (Postgres)."
  type        = list(string)
}

variable "flow_log_role_arn" {
  description = "ARN of the IAM role that delivers VPC flow logs to CloudWatch Logs."
  type        = string
}
