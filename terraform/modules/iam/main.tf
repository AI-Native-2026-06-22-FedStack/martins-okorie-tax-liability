# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — IAM base module
#
# Resources (Terraform-owned):
#   ECS task execution role, ECS task role, task runtime inline policy
#
# Data sources (read-only):
#   aws_iam_policy — reads the existing AWS-managed ECS execution policy
# ─────────────────────────────────────────────────────────────────────────────

# ── Data sources (read-only) ────────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    sid     = "AllowEcsTasksToAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── ECS Task Execution Role ────────────────────────────────────────────────

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Name        = "${var.project_name}-ecs-execution"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── ECS Task Role (runtime permissions) ────────────────────────────────────

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json

  tags = {
    Name        = "${var.project_name}-ecs-task"
    Environment = var.environment
  }
}

# Inline policy — same scope as M7 iam/task-role.json
resource "aws_iam_role_policy" "task_runtime" {
  name   = "${var.project_name}-runtime-aws-calls"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.task_runtime.json
}

data "aws_iam_policy_document" "task_runtime" {
  # SecretsManager read for DB password and JWT signing keys
  statement {
    sid    = "ReadRuntimeSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      "arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/db-password",
      "arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/jwt-signing-keys",
    ]
  }

  # DynamoDB operations for plan-cycle read model
  statement {
    sid    = "MaintainPlanCycleQueueReadModel"
    effect = "Allow"
    actions = [
      "dynamodb:BatchWriteItem",
      "dynamodb:CreateTable",
      "dynamodb:DescribeTable",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [
      "arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model",
      "arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model/index/GSI1",
    ]
  }

  # SNS publish and subscribe for stage-changed topic
  statement {
    sid    = "PublishAndConfigureStageChangedTopic"
    effect = "Allow"
    actions = [
      "sns:CreateTopic",
      "sns:Publish",
      "sns:Subscribe",
    ]
    resources = [
      "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed",
    ]
  }

  # SQS operations for stage-changed projection and DLQ
  statement {
    sid    = "ConfigureAndConsumeStageChangedQueues"
    effect = "Allow"
    actions = [
      "sqs:CreateQueue",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
      "sqs:SendMessage",
      "sqs:SetQueueAttributes",
    ]
    resources = [
      "arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection",
      "arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-dlq",
    ]
  }
}

# ── VPC Flow Log Delivery Role ──────────────────────────────────────────────

data "aws_iam_policy_document" "flow_log_assume_role" {
  statement {
    sid     = "AllowVpcFlowLogToAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_log" {
  name               = "${var.project_name}-vpc-flow-log"
  assume_role_policy = data.aws_iam_policy_document.flow_log_assume_role.json

  tags = {
    Name        = "${var.project_name}-vpc-flow-log"
    Environment = var.environment
  }
}

data "aws_iam_policy_document" "flow_log_permissions" {
  # checkov:skip=CKV_AWS_111: Flow log delivery requires resource * for CloudWatch Logs stream creation — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_356: Flow log delivery requires resource * for CloudWatch Logs stream creation — reviewed in ADR-0023
  statement {
    sid    = "AllowFlowLogToCloudWatch"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "flow_log" {
  # checkov:skip=CKV_AWS_111: Flow log delivery requires resource * for CloudWatch Logs stream creation — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_356: Flow log delivery requires resource * for CloudWatch Logs stream creation — reviewed in ADR-0023
  name   = "${var.project_name}-vpc-flow-log-policy"
  role   = aws_iam_role.flow_log.id
  policy = data.aws_iam_policy_document.flow_log_permissions.json
}
