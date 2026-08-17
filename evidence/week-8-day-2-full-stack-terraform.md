# Evidence — Week 8 Day 2 (Full-Stack Terraform)

This document provides compliance and verification evidence for the full-stack layered Terraform composition, provider-wide `default_tags`, stateful lifecycle safety guards (`prevent_destroy` and `deletion_protection`), out-of-band Secrets Manager wiring, and whole-stack Checkov & Trivy scanning.

---

## 1. Provider Configuration & Stack-Wide `default_tags`

The root AWS provider in `infra/terraform/providers.tf` declares `default_tags` so that every managed resource automatically carries standard attribution tags (`Name`, `Owner`, `Environment`):

```hcl
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
```

---

## 2. Stateful Store Lifecycle Guards & Replacement Attack Test

Every stateful data store (`aws_db_instance.main`, `aws_dynamodb_table.plan_cycle_read_model`, `aws_elasticache_replication_group.main`) is guarded by `lifecycle { prevent_destroy = true }`, and provider-side `deletion_protection = true` is enabled on RDS and DynamoDB.

### Attack Verification
When an accidental or un-reviewed schema change forces replacement (`-/+`), `terraform plan` immediately halts execution with an error instead of permitting data loss:

```
Error: Instance cannot be destroyed

  on modules/data/main.tf line 24:
  24: resource "aws_db_instance" "main" {

Resource module.data.aws_db_instance.main has lifecycle.prevent_destroy
set, but the plan calls for this resource to be destroyed. To avoid this
error and continue with the plan, either disable lifecycle.prevent_destroy
or reduce the scope of the plan using the -target option.
```

---

## 3. Secrets Manager Wiring — ARNs Only, Zero Plaintext

Secrets are managed strictly through container declarations in Terraform:
- `aws_secretsmanager_secret.db_password` (`taxpulse/local/db-password`)
- `aws_secretsmanager_secret.jwt_signing_keys` (`taxpulse/local/jwt-signing-keys`)

The raw values are populated out-of-band via AWS CLI:
```bash
$ aws --endpoint-url http://localhost:4566 secretsmanager put-secret-value \
    --secret-id "taxpulse/local/db-password" \
    --secret-string "<redacted out-of-band value>"

$ aws --endpoint-url http://localhost:4566 secretsmanager put-secret-value \
    --secret-id "taxpulse/local/jwt-signing-keys" \
    --secret-string "<redacted out-of-band value>"
```

ECS Task Definitions reference secrets exclusively by ARN via `valueFrom`:
```hcl
secrets = [
  {
    name      = "DATABASE_PASSWORD"
    valueFrom = var.db_password_secret_arn
  },
  {
    name      = "JWT_SIGNING_KEYS"
    valueFrom = var.jwt_signing_keys_secret_arn
  }
]
```

No plaintext secrets exist in Terraform configuration, state files, or plan output.

---

## 4. Whole-Stack IaC Scanning Results (Checkov + Trivy)

Running `./terraform/scripts/scan.sh` across the entire composed stack:

```
Running Checkov scan on infra/terraform...
...
✔ Checkov passed.

▸ Running Trivy config scan...
2026-08-14T12:35:20-04:00	INFO	[misconfig] Misconfiguration scanning is enabled
2026-08-14T12:35:21-04:00	INFO	[terraform scanner] Scanning root module	file_path="."
2026-08-14T12:35:21-04:00	INFO	Detected config files	num=4

Report Summary

┌─────────────────────────┬────────────────────────┬───────────────────┐
│         Target          │          Type          │ Misconfigurations │
├─────────────────────────┼────────────────────────┼───────────────────┤
│ .                       │ terraformplan-snapshot │         0         │
├─────────────────────────┼────────────────────────┼───────────────────┤
│ modules/app/main.tf     │       terraform        │         0         │
├─────────────────────────┼────────────────────────┼───────────────────┤
│ modules/data/main.tf    │       terraform        │         0         │
├─────────────────────────┼────────────────────────┼───────────────────┤
│ modules/network/main.tf │ terraformplan-snapshot │         0         │
└─────────────────────────┴────────────────────────┴───────────────────┘

✔ Trivy passed.

▸ SARIF evidence written to: artifacts/security/
- results_cli.txt (52 KB)
- results_sarif.sarif (118 KB)
- trivy-results.sarif (16 KB)
```

All suppressions are cataloged with operational justifications in [`docs/adr/0023-iac-scanning-policy.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0023-iac-scanning-policy.md).

---

## 5. Stable Full-Stack Terraform Outputs

```
Outputs:

alb_arn = "arn:aws:elasticloadbalancing:us-east-1:000000000000:loadbalancer/app/taxpulse-dev-alb/6cb34c990f3e46f5"
alb_dns_name = "taxpulse-dev-alb-6cb34c990f3e46f5.elb.localhost.floci.io"
api_url = "http://taxpulse-dev-alb-6cb34c990f3e46f5.elb.localhost.floci.io"
db_endpoint = "172.17.0.2:7001"
db_password_secret_arn = "arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/db-password-K7SLXZ"
dynamodb_table_name = "taxpulse-plan-cycle-read-model"
execution_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-execution"
observability_status = "ready-for-m8d4-alarms"
private_app_subnet_ids = [
  "subnet-171ba989",
  "subnet-9f1eb450",
]
private_db_subnet_ids = [
  "subnet-14b85656",
  "subnet-f52f540c",
]
public_subnet_ids = [
  "subnet-8b3340a7",
  "subnet-b807675f",
]
service_name = "taxpulse-api"
sns_stage_changed_topic_arn = "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
spa_url = "http://taxpulse-dev-spa.s3-website-us-east-1.amazonaws.com"
task_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-task"
vpc_id = "vpc-0ad6dbe3"
```
