# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Observability module: Golden Signal Alarm
#
# Release-health tripwire: Exactly ONE actionable CloudWatch metric alarm on a
# golden signal (Target 5XX Error Rate) for the Core Case Service.
# Requires breach to hold across >1 evaluation period and links to rollback runbook.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "alarms_kms" {
  # checkov:skip=CKV_AWS_109: KMS key policy requires resource * because key policy is attached directly to the key itself — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_111: KMS key policy requires resource * because key policy is attached directly to the key itself — reviewed in ADR-0023
  # checkov:skip=CKV_AWS_356: KMS key policy requires resource * because key policy is attached directly to the key itself — reviewed in ADR-0023
  statement {
    sid       = "EnableRootPermissions"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid    = "AllowCloudWatchAlarmsAndSNS"
    effect = "Allow"
    actions = [
      "kms:GenerateDataKey*",
      "kms:Decrypt",
    ]
    resources = ["*"]

    principals {
      type = "Service"
      identifiers = [
        "cloudwatch.amazonaws.com",
        "sns.amazonaws.com",
      ]
    }
  }
}

resource "aws_kms_key" "alarms" {
  description             = "KMS CMK for CloudWatch alarms SNS release health alerts topic encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.alarms_kms.json

  tags = {
    Name        = "${var.project_name}-alarms-kms-key"
    Environment = var.environment
  }
}

resource "aws_sns_topic" "release_health_alerts" {
  name              = "${var.project_name}-${var.environment}-release-health-alerts"
  kms_master_key_id = aws_kms_key.alarms.id

  tags = {
    Name        = "${var.project_name}-release-health-alerts"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "core_case_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-core-case-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.release_health_alerts.arn]
  ok_actions    = [aws_sns_topic.release_health_alerts.arn]

  alarm_description = "High 5XX error count on Core Case Service across 3 consecutive evaluation periods. Release-health breach detected. Runbook: docs/runbook-rollback.md"

  tags = {
    Name         = "${var.project_name}-core-case-5xx-alarm"
    Environment  = var.environment
    GoldenSignal = "errors"
    Runbook      = "docs/runbook-rollback.md"
  }
}
