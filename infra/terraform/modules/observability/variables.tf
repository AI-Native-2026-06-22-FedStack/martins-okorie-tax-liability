# ─────────────────────────────────────────────────────────────────────────────
# Observability module variables — declares typed inputs from module.app
# ─────────────────────────────────────────────────────────────────────────────

variable "project_name" {
  type        = string
  description = "Project name prefix applied to all resources."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, test, prod)."
}

variable "service_name" {
  type        = string
  description = "Name of the Core Case Service ECS service (from module.app.service_name)."
}

variable "alb_arn" {
  type        = string
  description = "ARN of the Application Load Balancer (from module.app.alb_arn)."
}

variable "alb_dns_name" {
  type        = string
  description = "DNS name of the Application Load Balancer (from module.app.alb_dns_name)."
}
