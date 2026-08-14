# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — Root module outputs
# ─────────────────────────────────────────────────────────────────────────────

# Network outputs
output "vpc_id" {
  description = "ID of the TaxPulse VPC."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (ALB placement)."
  value       = module.network.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "IDs of the private app subnets (Fargate tasks)."
  value       = module.network.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  description = "IDs of the private DB subnets (Postgres)."
  value       = module.network.private_db_subnet_ids
}

output "alb_security_group_id" {
  description = "ID of the ALB security group."
  value       = module.network.alb_security_group_id
}

output "task_security_group_id" {
  description = "ID of the Fargate task security group."
  value       = module.network.task_security_group_id
}

output "db_security_group_id" {
  description = "ID of the database security group."
  value       = module.network.db_security_group_id
}

# IAM outputs
output "execution_role_arn" {
  description = "ARN of the ECS task execution role."
  value       = module.iam.execution_role_arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role."
  value       = module.iam.task_role_arn
}
