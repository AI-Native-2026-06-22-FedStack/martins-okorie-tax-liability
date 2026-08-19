# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse — Observability module: Golden Signal Alarm
#
# Release-health tripwire: Exactly ONE actionable CloudWatch metric alarm on a
# golden signal (Target 5XX Error Rate) for the Core Case Service.
# Requires breach to hold across >1 evaluation period and links to rollback runbook.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "release_health_alerts" {
  name = "${var.project_name}-${var.environment}-release-health-alerts"

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
