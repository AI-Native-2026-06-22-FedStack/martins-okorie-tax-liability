# ─────────────────────────────────────────────────────────────────────────────
# App module variables — consumes outputs from network, iam, and data
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  type        = string
  description = "Project name prefix applied to all resources."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, test, prod)."
}

variable "aws_region" {
  type        = string
  description = "AWS region for deployment."
  default     = "us-east-1"
}

# ── Consumed from module.network ────────────────────────────────────────────

variable "vpc_id" {
  type        = string
  description = "VPC ID where application and load balancer are deployed."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs for ALB placement."
}

variable "private_app_subnet_ids" {
  type        = list(string)
  description = "Private app subnet IDs for ECS task placement."
}

variable "alb_security_group_id" {
  type        = string
  description = "Security group ID attached to the ALB."
}

variable "task_security_group_id" {
  type        = string
  description = "Security group ID attached to ECS Fargate tasks."
}

# ── Consumed from module.iam ────────────────────────────────────────────────

variable "execution_role_arn" {
  type        = string
  description = "ECS task execution role ARN for pulling images and fetching runtime secrets."
}

variable "task_role_arn" {
  type        = string
  description = "ECS task role ARN for runtime AWS service calls."
}

# ── Consumed from module.data ───────────────────────────────────────────────

variable "db_address" {
  type        = string
  description = "PostgreSQL hostname from data module."
}

variable "db_port" {
  type        = number
  description = "PostgreSQL port from data module."
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name from data module."
}

variable "db_password_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for DB password."
}

variable "jwt_signing_keys_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for JWT signing keys."
}

variable "dynamodb_read_model_table_name" {
  type        = string
  description = "DynamoDB table name for plan cycle read model."
}

variable "redis_endpoint" {
  type        = string
  description = "ElastiCache Redis endpoint hostname."
}

variable "redis_port" {
  type        = number
  description = "ElastiCache Redis port."
}

variable "sns_stage_changed_topic_arn" {
  type        = string
  description = "ARN of the stage-changed SNS topic."
}

variable "sqs_stage_changed_projection_queue_url" {
  type        = string
  description = "URL of the stage-changed projection SQS queue."
}
