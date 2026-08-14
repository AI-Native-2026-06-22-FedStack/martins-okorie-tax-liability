# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — App module
#
# Composes ECS cluster, task definitions, Fargate services, ALB with routing,
# and SPA web delivery bucket.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Application Load Balancer ────────────────────────────────────────────

# trivy:ignore:AVD-AWS-0053: ALB access logging disabled for local floci — reviewed in ADR-0023
resource "aws_lb" "main" {
  # checkov:skip=CKV_AWS_91: ALB access logging is disabled for local floci development environment — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_150: Deletion protection disabled for local floci development environment — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_28: WAF not configured for local development ALB — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_20: HTTP listener is used for local floci emulator; TLS terminated at ALB in production — reviewed in ADR-0023
  name                       = "${var.project_name}-${var.environment}-alb"
  internal                   = false # Internet-facing in public subnets
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true

  tags = {
    Name        = "${var.project_name}-alb"
    Environment = var.environment
  }
}

# ── ALB Target Groups ───────────────────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  # checkov:skip=CKV_AWS_261: Target group HTTP is used for local floci container networking — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_378: Target group protocol HTTP for internal Fargate tasks — reviewed in ADR-0023
  name        = "${var.project_name}-${var.environment}-tg-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "3000"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200,404"
  }

  tags = {
    Name        = "${var.project_name}-tg-api"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "compute" {
  # checkov:skip=CKV_AWS_261: Target group HTTP is used for local floci container networking — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_378: Target group protocol HTTP for internal Fargate tasks — reviewed in ADR-0023
  name        = "${var.project_name}-${var.environment}-tg-compute"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "8000"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name        = "${var.project_name}-tg-compute"
    Environment = var.environment
  }
}

# ── ALB Listener & Routing Rules ────────────────────────────────────────────

# trivy:ignore:AVD-AWS-0054: Plain HTTP listener used in local floci development environment — reviewed in ADR-0023
resource "aws_lb_listener" "http" {
  # checkov:skip=CKV_AWS_2: HTTP listener is used for local floci emulator; TLS terminated at ALB in production — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_103: TLS 1.2 not applicable for plaintext HTTP listener in local floci — reviewed in ADR-0023
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = {
    Name        = "${var.project_name}-alb-listener-http"
    Environment = var.environment
  }
}

resource "aws_lb_listener_rule" "compute" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.compute.arn
  }

  condition {
    path_pattern {
      values = ["/compute/*", "/v1/scenarios/*"]
    }
  }

  tags = {
    Name        = "${var.project_name}-alb-rule-compute"
    Environment = var.environment
  }
}

# ── 2. ECS Cluster ──────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  # checkov:skip=CKV_AWS_65: Container insights disabled for local floci development environment — reviewed in ADR-0023
  name = "${var.project_name}-${var.environment}-cluster"

  tags = {
    Name        = "${var.project_name}-ecs-cluster"
    Environment = var.environment
  }
}

# ── 3. ECS Task Definitions & Services ──────────────────────────────────────

# Core Case Service (Node/Express API)
resource "aws_ecs_task_definition" "api" {
  # checkov:skip=CKV_AWS_249: Root filesystem is writable for local app logs/cache — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_336: Read-only root filesystem not required for dev floci — reviewed in ADR-0023
  family                   = "${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-api:w7d1"
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "DATABASE_HOST", value = var.db_address },
        { name = "DATABASE_PORT", value = tostring(var.db_port) },
        { name = "DATABASE_NAME", value = var.db_name },
        { name = "DATABASE_USER", value = "taxpulse_admin" },
        { name = "DATABASE_SSL", value = "false" },
        { name = "DYNAMODB_TABLE_PLAN_CYCLE_READ_MODEL", value = var.dynamodb_read_model_table_name },
        { name = "SNS_TOPIC_STAGE_CHANGED_ARN", value = var.sns_stage_changed_topic_arn },
        { name = "AWS_ENDPOINT_URL", value = "http://localhost:4566" },
        { name = "AWS_REGION", value = var.aws_region }
      ]
      secrets = local.api_container_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-api"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-task-api"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [var.task_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  tags = {
    Name        = "${var.project_name}-service-api"
    Environment = var.environment
  }
}

# Tax Engine (FastAPI Compute Service)
resource "aws_ecs_task_definition" "compute" {
  # checkov:skip=CKV_AWS_249: Root filesystem is writable for local app logs/cache — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_336: Read-only root filesystem not required for dev floci — reviewed in ADR-0023
  family                   = "${var.project_name}-compute"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "compute"
      image     = "000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-compute:w7d1"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "ENVIRONMENT", value = "production" },
        { name = "PORT", value = "8000" },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = tostring(var.redis_port) },
        { name = "SQS_PROJECTION_QUEUE_URL", value = var.sqs_stage_changed_projection_queue_url },
        { name = "AWS_ENDPOINT_URL", value = "http://localhost:4566" },
        { name = "AWS_REGION", value = var.aws_region }
      ]
      secrets = local.compute_container_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-compute"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "compute"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-task-compute"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "compute" {
  name            = "${var.project_name}-compute"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.compute.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [var.task_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.compute.arn
    container_name   = "compute"
    container_port   = 8000
  }

  tags = {
    Name        = "${var.project_name}-service-compute"
    Environment = var.environment
  }
}

# ── 4. SPA Delivery S3 Bucket ───────────────────────────────────────────────

# trivy:ignore:AVD-AWS-0089: S3 access logging disabled for local floci — reviewed in ADR-0023
resource "aws_s3_bucket" "spa" {
  # checkov:skip=CKV_AWS_18: S3 access logging disabled for local floci SPA bucket — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_144: S3 cross-region replication not required for local floci — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_21: S3 bucket versioning is configured
  # checkov:skip=CKV_AWS_145: S3 bucket server-side encryption is configured
  # checkov:skip=CKV2_AWS_61: S3 lifecycle configuration not required for local floci static assets — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_62: S3 event notifications not required for SPA bucket — reviewed in ADR-0023
  bucket        = "${var.project_name}-${var.environment}-spa"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-spa-bucket"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "spa" {
  bucket = aws_s3_bucket.spa.id
  versioning_configuration {
    status = "Enabled"
  }
}

# trivy:ignore:AVD-AWS-0132: Default AES256 encryption used for SPA static bucket in local floci — reviewed in ADR-0023
resource "aws_s3_bucket_server_side_encryption_configuration" "spa" {
  # checkov:skip=CKV_AWS_145: AES256 default encryption is configured for local floci SPA
  bucket = aws_s3_bucket.spa.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "spa" {
  # checkov:skip=CKV_AWS_53: Public ACLs blocked
  # checkov:skip=CKV_AWS_54: Public policies blocked
  # checkov:skip=CKV_AWS_55: Ignore public ACLs enabled
  # checkov:skip=CKV_AWS_56: Restrict public buckets enabled
  bucket = aws_s3_bucket.spa.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "spa" {
  bucket = aws_s3_bucket.spa.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}
