# ─────────────────────────────────────────────────────────────────────────────
# Network module variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name prefix for tags and resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC."
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB tier)."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private app subnets (ECS task tier)."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private DB subnets (Postgres tier)."
  type        = list(string)
}

variable "flow_log_role_arn" {
  description = "IAM role ARN for VPC flow log CloudWatch delivery."
  type        = string
}
