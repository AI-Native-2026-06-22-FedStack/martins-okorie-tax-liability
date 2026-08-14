# ─────────────────────────────────────────────────────────────────────────────
# IAM module outputs
# ─────────────────────────────────────────────────────────────────────────────

output "execution_role_arn" {
  description = "ARN of the ECS task execution role."
  value       = aws_iam_role.ecs_execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role."
  value       = aws_iam_role.ecs_task.arn
}

output "flow_log_role_arn" {
  description = "ARN of the VPC flow log delivery role."
  value       = aws_iam_role.flow_log.arn
}
