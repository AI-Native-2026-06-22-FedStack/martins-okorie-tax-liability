# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Network base module
#
# Resources (Terraform-owned):
#   VPC, subnets, internet gateway, route tables, security groups
#
# Data sources (read-only):
#   aws_availability_zones — reads existing AZs, never creates them
# ─────────────────────────────────────────────────────────────────────────────

# ── Data sources (read-only) ────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

# ── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
  }
}

# CKV2_AWS_12: Restrict the VPC default security group to deny all traffic.
# The default SG is created automatically with the VPC; this resource takes
# ownership and removes all ingress/egress so only named SGs carry rules.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-default-sg-restricted"
    Environment = var.environment
  }
}

# CKV2_AWS_11: Enable VPC flow logging for network audit trail.
resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  # checkov:skip=CKV_AWS_158: encryption using default log group encryption is acceptable for development floci environment — reviewed in ADR-0023
  name              = "/aws/vpc/${var.project_name}-${var.environment}/flow-logs"
  retention_in_days = 365

  tags = {
    Name        = "${var.project_name}-vpc-flow-logs"
    Environment = var.environment
  }
}

resource "aws_flow_log" "vpc" {
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination_type = "cloud-watch-logs"
  log_destination      = aws_cloudwatch_log_group.vpc_flow_log.arn
  iam_role_arn         = var.flow_log_role_arn

  tags = {
    Name        = "${var.project_name}-vpc-flow-log"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [iam_role_arn, tags]
  }
}

# ── Internet Gateway ────────────────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-igw"
    Environment = var.environment
  }
}

# ── Public Subnets (ALB placement) ──────────────────────────────────────────

# checkov:skip=CKV_AWS_130: public subnets host the internet-facing ALB by design (ADR-0020) — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0164: public subnets with auto-assign public IP are required for the ALB tier (ADR-0020) — reviewed in ADR-0023
resource "aws_subnet" "public" {
  # checkov:skip=CKV_AWS_130: public subnets host the internet-facing ALB by design (ADR-0020) — reviewed in ADR-0023
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-public-${data.aws_availability_zones.available.names[count.index]}"
    Environment = var.environment
    Tier        = "public"
  }
}

# ── Private App Subnets (Fargate tasks) ─────────────────────────────────────

resource "aws_subnet" "private_app" {
  count = length(var.private_app_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_app_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-private-app-${data.aws_availability_zones.available.names[count.index]}"
    Environment = var.environment
    Tier        = "private-app"
  }
}

# ── Private DB Subnets (Postgres) ───────────────────────────────────────────

resource "aws_subnet" "private_db" {
  count = length(var.private_db_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_db_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-private-db-${data.aws_availability_zones.available.names[count.index]}"
    Environment = var.environment
    Tier        = "private-db"
  }
}

# ── Route Tables ────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-public-rt"
    Environment = var.environment
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-private-app-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private_app" {
  count = length(aws_subnet.private_app)

  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app.id
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-private-db-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private_db" {
  count = length(aws_subnet.private_db)

  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db.id
}

# ── Security Groups ────────────────────────────────────────────────────────

# ALB security group — internet entrypoint
# checkov:skip=CKV2_AWS_5: SG is defined now; ALB attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
resource "aws_security_group" "alb" {
  # checkov:skip=CKV2_AWS_5: SG is defined now; ALB attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
  name        = "${var.project_name}-alb-sg"
  description = "Internet entrypoint for the TaxPulse ALB."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-alb-sg"
    Environment = var.environment
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet to the ALB only."
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"

  lifecycle {
    ignore_changes = all
  }
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward HTTPS listener traffic to API tasks."
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.task.id

  lifecycle {
    ignore_changes = all
  }
}

resource "aws_vpc_security_group_egress_rule" "alb_to_compute" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward internal Tax Engine traffic to compute tasks."
  from_port                    = 8000
  to_port                      = 8000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.task.id

  lifecycle {
    ignore_changes = all
  }
}

# Task security group — private Fargate tasks
# checkov:skip=CKV2_AWS_5: SG is defined now; ECS task attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
resource "aws_security_group" "task" {
  # checkov:skip=CKV2_AWS_5: SG is defined now; ECS task attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
  name        = "${var.project_name}-task-sg"
  description = "Private Fargate tasks; inbound traffic is ALB-originated only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-task-sg"
    Environment = var.environment
  }
}

resource "aws_vpc_security_group_ingress_rule" "task_from_alb_api" {
  security_group_id            = aws_security_group.task.id
  description                  = "Core Case Service from alb-sg only."
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id

  lifecycle {
    ignore_changes = all
  }
}

resource "aws_vpc_security_group_ingress_rule" "task_from_alb_compute" {
  security_group_id            = aws_security_group.task.id
  description                  = "Tax Engine from alb-sg only."
  from_port                    = 8000
  to_port                      = 8000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id

  lifecycle {
    ignore_changes = all
  }
}

resource "aws_vpc_security_group_egress_rule" "task_to_db" {
  security_group_id            = aws_security_group.task.id
  description                  = "Database access from app tasks to Postgres only."
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.db.id

  lifecycle {
    ignore_changes = all
  }
}

# trivy:ignore:AVD-AWS-0104: tasks need outbound HTTPS for AWS API calls (SecretsManager, DynamoDB, SNS, SQS) — reviewed in ADR-0023
resource "aws_vpc_security_group_egress_rule" "task_to_aws" {
  security_group_id = aws_security_group.task.id
  description       = "AWS API calls through VPC endpoints or floci."
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"

  lifecycle {
    ignore_changes = all
  }
}

# Database security group — private Postgres
# checkov:skip=CKV2_AWS_5: SG is defined now; RDS/Postgres attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
resource "aws_security_group" "db" {
  # checkov:skip=CKV2_AWS_5: SG is defined now; RDS/Postgres attachment comes in 8.2 Full-Stack Terraform — reviewed in ADR-0023
  name        = "${var.project_name}-db-sg"
  description = "Private Postgres; inbound traffic is app-task-originated only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-db-sg"
    Environment = var.environment
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_task" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from task-sg only."
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.task.id

  lifecycle {
    ignore_changes = all
  }
}
