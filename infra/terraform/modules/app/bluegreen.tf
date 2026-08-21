# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — App module: Native ECS Blue/Green Cutover
#
# Declares dual target groups (blue + green) and the ECS deployment strategy
# ensuring the serving revision is never mutated in place.
# ─────────────────────────────────────────────────────────────────────────────

# Alternate Target Group (Green) — allows green revision to spin up beside blue
resource "aws_lb_target_group" "api_green" {
  # checkov:skip=CKV_AWS_261: Target group HTTP is used for local floci container networking — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_378: Target group protocol HTTP for internal Fargate tasks — reviewed in ADR-0023
  name        = "${var.project_name}-${var.environment}-tg-api-green"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "3000"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name        = "${var.project_name}-tg-api-green"
    Environment = var.environment
    Slot        = "green"
  }
}

# Production Listener Routing Rule for Blue/Green Cutover
resource "aws_lb_listener_rule" "api_production" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/auth/*", "/v1/*", "/health*"]
    }
  }

  tags = {
    Name        = "${var.project_name}-alb-rule-api-production"
    Environment = var.environment
  }
}
