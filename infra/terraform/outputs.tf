# ─────────────────────────────────────────────────────────────────────────────
# Root outputs — exposes public endpoints and cross-module references
# ─────────────────────────────────────────────────────────────────────────────

# ── Public Endpoints ─────────────────────────────────────────────────────────

output "api_url" {
  description = "Public HTTP URL of the Application Load Balancer routing to the API and Compute services."
  value       = module.app.api_url
}

output "spa_url" {
  description = "Public URL for the SPA delivery S3 static website."
  value       = module.app.spa_url
}

# ── Network Layer Outputs ───────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID created by the network module."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ALB."
  value       = module.network.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "Private app subnet IDs for ECS tasks."
  value       = module.network.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  description = "Private DB subnet IDs for RDS and ElastiCache."
  value       = module.network.private_db_subnet_ids
}

# ── IAM Layer Outputs ───────────────────────────────────────────────────────

output "execution_role_arn" {
  description = "ECS execution role ARN created by IAM module."
  value       = module.iam.execution_role_arn
}

output "task_role_arn" {
  description = "ECS task runtime role ARN created by IAM module."
  value       = module.iam.task_role_arn
}

# ── Data Layer Outputs ──────────────────────────────────────────────────────

output "db_endpoint" {
  description = "PostgreSQL endpoint from data module."
  value       = module.data.db_endpoint
}

output "db_password_secret_arn" {
  description = "Secrets Manager DB password secret ARN."
  value       = module.data.db_password_secret_arn
}

output "dynamodb_table_name" {
  description = "DynamoDB plan cycle read model table name."
  value       = module.data.dynamodb_read_model_table_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint."
  value       = module.data.redis_endpoint
}

output "sns_stage_changed_topic_arn" {
  description = "SNS stage-changed topic ARN."
  value       = module.data.sns_stage_changed_topic_arn
}

# ── App Layer Outputs ───────────────────────────────────────────────────────

output "alb_arn" {
  description = "ALB ARN created by app module."
  value       = module.app.alb_arn
}

output "alb_dns_name" {
  description = "ALB DNS name created by app module."
  value       = module.app.alb_dns_name
}

output "service_name" {
  description = "ECS Core Case Service name."
  value       = module.app.service_name
}

# ── Observability Layer Outputs ─────────────────────────────────────────────

output "observability_status" {
  description = "Observability seam status."
  value       = module.observability.observability_seam_status
}
