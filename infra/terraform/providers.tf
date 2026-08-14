# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — AWS Provider configuration with stack-wide default_tags
# ─────────────────────────────────────────────────────────────────────────────

provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  default_tags {
    tags = {
      Owner       = "tax-platform-team"
      Environment = var.environment
      Name        = var.project_name
    }
  }

  # Point AWS services at floci local emulator
  endpoints {
    ec2            = "http://localhost:4566"
    iam            = "http://localhost:4566"
    s3             = "http://localhost:4566"
    sts            = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    sns            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    cloudwatchlogs = "http://localhost:4566"
    rds            = "http://localhost:4566"
    elasticache    = "http://localhost:4566"
    ecs            = "http://localhost:4566"
    elb            = "http://localhost:4566"
    elbv2          = "http://localhost:4566"
  }
}
