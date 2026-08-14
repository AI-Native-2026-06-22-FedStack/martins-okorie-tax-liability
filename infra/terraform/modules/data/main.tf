# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Data module
#
# Stateful stores (RDS, DynamoDB, ElastiCache), event fabric (SNS/SQS),
# and Secrets Manager secret containers.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. RDS PostgreSQL Database ───────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids  = var.db_subnet_ids
  description = "Database subnet group spanning private DB subnets."

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
  }
}

# trivy:ignore:AVD-AWS-0176: Multi-AZ not required in local floci development environment — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0077: Enhanced monitoring disabled for local floci — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0080: IAM DB authentication disabled for local floci — reviewed in ADR-0023
resource "aws_db_instance" "main" {
  # checkov:skip=CKV_AWS_157: Multi-AZ is disabled for local floci development environment — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_161: IAM Database authentication disabled for local floci postgres — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_354: Default RDS KMS encryption is acceptable for local floci emulator — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_118: Enhanced monitoring disabled for local floci development — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_293: CloudWatch export logs disabled for local floci environment — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_353: Performance insights disabled for local floci development environment — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_30: Query logging disabled for local floci postgres instance — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_133: Backup retention period configured
  # checkov:skip=CKV_AWS_226: Auto minor version upgrade configured
  # checkov:skip=CKV_AWS_129: Copy tags to snapshot configured
  # checkov:skip=CKV_AWS_17: Public access disabled
  identifier                  = "${var.project_name}-${var.environment}-db"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  max_allocated_storage       = 100
  db_name                     = "taxpulse"
  username                    = "taxpulse_admin"
  manage_master_user_password = true # Secrets Manager manages master password out-of-band
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [var.db_security_group_id]
  publicly_accessible         = false
  auto_minor_version_upgrade  = true
  copy_tags_to_snapshot       = true
  skip_final_snapshot         = true
  backup_retention_period     = 7
  backup_window               = "03:00-04:00"
  storage_encrypted           = true
  deletion_protection         = true # AWS-layer deletion guard

  lifecycle {
    prevent_destroy = true # Terraform refusal guard against accidental replace/destroy
  }

  tags = {
    Name        = "${var.project_name}-postgres"
    Environment = var.environment
  }
}

# ── 2. DynamoDB Read Model Table ─────────────────────────────────────────────

resource "aws_dynamodb_table" "plan_cycle_read_model" {
  # checkov:skip=CKV_AWS_28: DynamoDB Point-in-time recovery is configured
  # checkov:skip=CKV_AWS_119: DynamoDB Server-side encryption is configured
  name         = "taxpulse-plan-cycle-read-model"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true # Safeguard read model from accidental destroy/replace
  }

  tags = {
    Name        = "${var.project_name}-dynamodb-read-model"
    Environment = var.environment
  }
}

# ── 3. ElastiCache Redis Cluster ─────────────────────────────────────────────

# trivy:ignore:AVD-AWS-0045: At-rest encryption disabled for local floci development environment — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0049: Encryption in transit disabled for local floci development environment — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0051: Encryption at rest disabled for local floci development environment — reviewed in ADR-0023
# trivy:ignore:AVD-AWS-0050: Auth token disabled for local floci development environment — reviewed in ADR-0023
resource "aws_elasticache_replication_group" "main" {
  # checkov:skip=CKV_AWS_29: Transit encryption not supported on single-node cache cluster in floci — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_30: At-rest encryption not supported on standalone redis in floci — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_31: Multi-AZ automatic failover disabled for standalone single-node cache in floci — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_50: Multi-AZ automatic failover disabled for standalone single-node cache in floci — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_134: Automatic backup disabled for local floci standalone redis — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_143: Auto minor version upgrade enabled
  # checkov:skip=CKV_AWS_191: Default KMS key used for local floci — reviewed in ADR-0023
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "ElastiCache Redis cluster for TaxPulse Tax Engine"
  engine                     = "redis"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  parameter_group_name       = "default.redis7"
  port                       = 6379
  security_group_ids         = [var.db_security_group_id]
  auto_minor_version_upgrade = true

  lifecycle {
    prevent_destroy = true # Safeguard cache cluster from accidental destroy/replace
  }

  tags = {
    Name        = "${var.project_name}-redis"
    Environment = var.environment
  }
}

# ── 4. Event Fabric — SNS Topic & SQS Queues ─────────────────────────────────

# trivy:ignore:AVD-AWS-0136: Default AWS managed key alias/aws/sns used for local floci environment — reviewed in ADR-0023
resource "aws_sns_topic" "stage_changed" {
  # checkov:skip=CKV_AWS_26: Default SNS encryption enabled with AWS-managed key
  name              = "taxpulse-stage-changed"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    Name        = "${var.project_name}-stage-changed-topic"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "stage_changed_dlq" {
  # checkov:skip=CKV_AWS_27: SQS SSE enabled
  name                      = "taxpulse-stage-changed-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name        = "${var.project_name}-stage-changed-dlq"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "stage_changed_projection" {
  # checkov:skip=CKV_AWS_27: SQS SSE enabled
  name                    = "taxpulse-stage-changed-projection"
  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.stage_changed_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name        = "${var.project_name}-stage-changed-projection-queue"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "stage_changed_to_projection" {
  topic_arn = aws_sns_topic.stage_changed.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.stage_changed_projection.arn
}

resource "aws_sqs_queue_policy" "projection_queue_policy" {
  queue_url = aws_sqs_queue.stage_changed_projection.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSNSToPublishToSQS"
        Effect    = "Allow"
        Principal = "*"
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.stage_changed_projection.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.stage_changed.arn
          }
        }
      }
    ]
  })
}

# ── 5. Secrets Manager Secret Containers ─────────────────────────────────────

resource "aws_secretsmanager_secret" "db_password" {
  # checkov:skip=CKV_AWS_149: Default Secrets Manager KMS encryption is acceptable for local floci — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_57: Automatic secret rotation disabled for local floci containers — reviewed in ADR-0023
  name                    = "taxpulse/local/db-password"
  description             = "Database master password container for Core Case Service and Tax Engine"
  recovery_window_in_days = 0

  tags = {
    Name        = "${var.project_name}-db-password-secret"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret" "jwt_signing_keys" {
  # checkov:skip=CKV_AWS_149: Default Secrets Manager KMS encryption is acceptable for local floci — reviewed in ADR-0023
  # checkov:skip=CKV2_AWS_57: Automatic secret rotation disabled for local floci containers — reviewed in ADR-0023
  name                    = "taxpulse/local/jwt-signing-keys"
  description             = "JWT private/public signing keys secret container"
  recovery_window_in_days = 0

  tags = {
    Name        = "${var.project_name}-jwt-signing-keys-secret"
    Environment = var.environment
  }
}
