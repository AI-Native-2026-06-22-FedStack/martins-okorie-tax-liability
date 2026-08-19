# ─────────────────────────────────────────────────────────────────────────────
# Observability module outputs
# ─────────────────────────────────────────────────────────────────────────────

output "observability_seam_status" {
  description = "Status of the observability module seam."
  value       = "configured-golden-signal-alarm"
}

output "golden_signal_alarm_name" {
  description = "Name of the golden signal CloudWatch metric alarm."
  value       = aws_cloudwatch_metric_alarm.core_case_5xx_errors.alarm_name
}

output "golden_signal_alarm_arn" {
  description = "ARN of the golden signal CloudWatch metric alarm."
  value       = aws_cloudwatch_metric_alarm.core_case_5xx_errors.arn
}
