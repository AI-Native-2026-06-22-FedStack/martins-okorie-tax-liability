# Prompt Journal: Full-Stack Terraform

## Entry 1

Asked — Save the Week 8 Day 2 "Full-Stack Terraform" lesson content as a helper reference file and create a new prompt journal.

Produced — Saved `helper/week-8-day-2-full-stack-terraform.md` with the full lesson covering all five topics (composing layered modules network → data → app → observability, stateful resource lifecycle safety and prevent_destroy guards, Secrets Manager wiring without leaking into state, stack-scale discipline with provider default_tags and Infracost, and the hands-on full-stack practice) and initialized `prompt-journal/0032-full-stack-terraform.md` as the next sequential prompt journal.

Accepted or rejected — Accepted.

Why — The lesson content is persisted in the helper directory for reference during implementation, and the prompt journal is initialized for subsequent entries on the `m8d2-implementation` branch.

## Entry 2

Asked — Compose the full-stack capstone as four reviewable infrastructure layers (`network` → `data` → `app` → `observability`) plus the `iam` base module under a single root and state boundary on floci, wiring all cross-module dependencies through outputs and variables rather than literal IDs, with `modules/observability` declared as a typed seam with no resources yet, and extend ADR-0022.

Produced — Created `modules/data` (PostgreSQL with `prevent_destroy` and `deletion_protection`, DynamoDB table with PITR, ElastiCache Redis, SNS topic, SQS queues with DLQ redrive, and Secrets Manager secret containers), `modules/app` (ALB with routing rules, ECS Fargate cluster, task definitions with `secrets` mapped via `valueFrom` ARNs, ECS services, and S3 SPA bucket), and `modules/observability` (typed variable inputs from `module.app` with zero resources as a seam for m8d4); configured `providers.tf` with stack-wide `default_tags`; composed all five modules in `infra/terraform/main.tf` and exposed public URLs in `infra/terraform/outputs.tf`; verified `terraform plan` cleanly resolved all 65 additions; ensured Checkov and Trivy scans passed with zero violations; and updated `docs/adr/0022-terraform-module-structure.md` and `docs/adr/ADR-0022-terraform-module-structure.md`.

Accepted or rejected — Accepted.

Why — The full-stack Terraform composition was verified against floci with 65 resources in a single plan, all cross-module values flow strictly through outputs to variables without hard-coded literals, and whole-stack Checkov and Trivy scanning passed cleanly.

## Entry 3

Asked — Guard the stateful stores with `lifecycle { prevent_destroy = true }` and `deletion_protection = true`, configure store backup postures (automated backups, point-in-time recovery), wire all secrets exclusively by ARN via Secrets Manager and ECS task definition `secrets` / `valueFrom` with raw secrets injected out-of-band, test and verify that destructive changes fail the plan, and ensure whole-stack Checkov and Trivy scans remain green.

Produced — Added `prevent_destroy = true` and `deletion_protection = true` to `aws_db_instance.main` with `manage_master_user_password = true` and 7-day backup retention; added `deletion_protection_enabled = true`, `point_in_time_recovery { enabled = true }`, and `prevent_destroy = true` to `aws_dynamodb_table.plan_cycle_read_model`; configured `aws_elasticache_replication_group.main` with `prevent_destroy = true`; eliminated all hardcoded passwords in Terraform configurations, storing secrets in Secrets Manager containers injected out-of-band and referenced via ARN; empirically verified that attempting a replace of a guarded resource causes `terraform plan` to fail with `Error: Instance cannot be destroyed`; verified clean re-plan (`No changes`); and confirmed Checkov and Trivy scans passed 100% green.

Accepted or rejected — Accepted.

Why — Accidental destruction protection and out-of-band secrets wiring were verified on floci, with destructive replacement attempts immediately halted by Terraform lifecycle guards and zero plaintext secrets appearing in code or state.
