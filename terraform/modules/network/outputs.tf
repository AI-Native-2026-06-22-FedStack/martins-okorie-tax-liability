# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Network base module outputs
# ─────────────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the TaxPulse VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (ALB placement)."
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "IDs of the private app subnets (Fargate tasks)."
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "IDs of the private DB subnets (Postgres)."
  value       = aws_subnet.private_db[*].id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group."
  value       = aws_security_group.alb.id
}

output "task_security_group_id" {
  description = "ID of the Fargate task security group."
  value       = aws_security_group.task.id
}

output "db_security_group_id" {
  description = "ID of the database security group."
  value       = aws_security_group.db.id
}
