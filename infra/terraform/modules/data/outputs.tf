# ─────────────────────────────────────────────────────────────────────────────
# Data module outputs
# ─────────────────────────────────────────────────────────────────────────────

output "db_endpoint" {
  description = "PostgreSQL connection endpoint (host:port)."
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "PostgreSQL connection hostname."
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "PostgreSQL connection port."
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "PostgreSQL database name."
  value       = aws_db_instance.main.db_name
}

output "db_instance_id" {
  description = "PostgreSQL instance identifier."
  value       = aws_db_instance.main.id
}

output "db_password_secret_arn" {
  description = "ARN of the Secrets Manager DB password secret container."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "jwt_signing_keys_secret_arn" {
  description = "ARN of the Secrets Manager JWT signing keys secret container."
  value       = aws_secretsmanager_secret.jwt_signing_keys.arn
}

output "dynamodb_read_model_table_name" {
  description = "DynamoDB plan cycle read model table name."
  value       = aws_dynamodb_table.plan_cycle_read_model.name
}

output "dynamodb_read_model_table_arn" {
  description = "DynamoDB plan cycle read model table ARN."
  value       = aws_dynamodb_table.plan_cycle_read_model.arn
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary cache node address."
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_port" {
  description = "ElastiCache Redis port."
  value       = aws_elasticache_cluster.main.port
}

output "sns_stage_changed_topic_arn" {
  description = "ARN of the stage-changed SNS topic."
  value       = aws_sns_topic.stage_changed.arn
}

output "sqs_stage_changed_projection_queue_url" {
  description = "URL of the stage-changed projection SQS queue."
  value       = aws_sqs_queue.stage_changed_projection.url
}

output "sqs_stage_changed_projection_queue_arn" {
  description = "ARN of the stage-changed projection SQS queue."
  value       = aws_sqs_queue.stage_changed_projection.arn
}
