# ─────────────────────────────────────────────────────────────────────────────
# App module outputs
# ─────────────────────────────────────────────────────────────────────────────

output "api_url" {
  description = "Public HTTP URL of the Application Load Balancer routing to Core Case Service & Tax Engine."
  value       = "http://${aws_lb.main.dns_name}"
}

output "spa_url" {
  description = "Public URL of the SPA delivery bucket."
  value       = "http://${aws_s3_bucket.spa.bucket}.s3-website-${var.aws_region}.amazonaws.com"
}

output "service_name" {
  description = "Name of the Core Case Service ECS service (consumed by observability module)."
  value       = aws_ecs_service.api.name
}

output "compute_service_name" {
  description = "Name of the Tax Engine ECS service."
  value       = aws_ecs_service.compute.name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer (consumed by observability module)."
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.main.arn
}

output "spa_bucket_name" {
  description = "Name of the S3 SPA delivery bucket."
  value       = aws_s3_bucket.spa.bucket
}

output "spa_bucket_arn" {
  description = "ARN of the S3 SPA delivery bucket."
  value       = aws_s3_bucket.spa.arn
}
