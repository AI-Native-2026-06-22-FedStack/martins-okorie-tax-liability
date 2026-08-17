# ADR-0022: Full-Stack Terraform Module Structure & Layered Composition

## Status
Accepted (Extended for 8.2 Full-Stack Terraform)

## Context
Modules 1–7 defined TaxPulse infrastructure through hand-crafted JSON definitions and shell scripts targeting local floci. This click-ops and imperative approach lacks reproducibility, auditability, state locking, and declarative change tracking. For a federal wealth-management SaaS system, infrastructure changes must be versioned, auditable, and rollback-able through declarative Infrastructure as Code.

In Lesson 1 (ADR-0022 Base), we established the foundational network and IAM module separation. In Lesson 2 (Full-Stack Terraform), we extend this architecture across all four primary infrastructure layers — `network` → `data` → `app` → `observability` — alongside the IAM base, composing all five child modules under one root module and one remote S3 state backend with S3-native locking (`use_lockfile = true`).

## Decision
Structure the TaxPulse capstone as five concern-based child modules under `infra/terraform/modules/`, composed atomically by the root module in `infra/terraform/main.tf`:

1. **Layered Architecture & Boundaries**:
   - `modules/network` (Layer 1 Base): Owns VPC, public/private subnets, internet gateway, NAT gateway routing, default security group lockdown, and tier security groups (`alb`, `task`, `db`).
   - `modules/iam` (Base): Owns ECS task execution role, task runtime role with scoped inline permissions, and VPC flow log role. Kept strictly separate from networking.
   - `modules/data` (Layer 2): Owns stateful data stores (RDS PostgreSQL with `deletion_protection = true` and `prevent_destroy = true`, DynamoDB plan-cycle read model with PITR, ElastiCache Redis cluster), event fabric (SNS topic `taxpulse-stage-changed`, SQS projection queue with DLQ redrive), and Secrets Manager secret containers (passwords/keys managed out of band).
   - `modules/app` (Layer 3): Owns compute and delivery infrastructure (Application Load Balancer with path routing rules, ECS Fargate cluster, task definitions for Core Case Service and Tax Engine with `secrets` mapped via `valueFrom` ARNs, ECS services, and S3 SPA static website delivery).
   - `modules/observability` (Layer 4 Seam): Deliberate seam layer declaring typed input variables (`service_name`, `alb_arn`, `alb_dns_name`) from `module.app` with NO resources created yet (alarms/dashboards authored in m8d4).

2. **Single Root Composition & State Boundary**:
   - All five child modules are called from `infra/terraform/main.tf` and share a single state file in the remote S3 backend (`taxpulse-tfstate-dev`) with S3-native state locking (`use_lockfile = true`).
   - Child modules never declare their own `backend` or `provider` blocks.

3. **Strict Cross-Module Output Wiring**:
   - Every cross-module dependency flows through output-to-variable wiring (e.g. `module.network.private_app_subnet_ids`, `module.iam.execution_role_arn`, `module.data.db_endpoint`, `module.data.db_password_secret_arn`).
   - No subnet ID, security group ID, role ARN, database endpoint, or secret ARN is ever hard-coded as a string literal outside the module that owns it.

4. **Secrets Discipline**:
   - Raw secrets (database passwords, JWT keys) never enter Terraform configuration, variables, or committed state files.
   - Terraform creates the secret containers in Secrets Manager; applications resolve secrets at runtime via ECS task definition `secrets: [{ name: "...", valueFrom: "<ARN>" }]`.

5. **Provider default_tags**:
   - Stack-wide tags (`Owner = "tax-platform-team"`, `Environment = var.environment`, `Name = var.project_name`) are enforced via `provider "aws" { default_tags { ... } }` in `providers.tf`.

## Consequences
- **Unified Review & Atomic Plan/Apply**: Running `terraform plan` evaluates the entire capstone stack atomically from one state file.
- **Stateful Safety**: Database and stateful stores are protected from accidental destruction via `deletion_protection` and `prevent_destroy`.
- **Zero Configuration Drift**: Changes to network CIDRs or IAM policies automatically propagate through module output bindings into application services.
- **Security & Compliance**: Sensitive credentials remain out of state, and Checkov + Trivy scans evaluate the entire composed stack with zero unjustified violations.
