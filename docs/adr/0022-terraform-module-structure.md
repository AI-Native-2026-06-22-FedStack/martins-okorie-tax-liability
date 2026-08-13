# ADR-0022: Terraform module structure

## Status
Accepted

## Context
Modules 1–7 defined TaxPulse infrastructure through hand-crafted JSON definitions and shell scripts targeting local floci. This click-ops and imperative approach lacks reproducibility, auditability, state locking, and declarative change tracking. For a federal wealth-management SaaS system, infrastructure changes must be versioned, auditable, and rollback-able through declarative Infrastructure as Code.

As we transition to Terraform, we must define the module and state boundary for the base infrastructure (networking and IAM) so that downstream application, data, and observability components in Lesson 2 can compose cleanly without code duplication or state fragmentation.

## Decision
Separate base infrastructure into concern-based child modules (`infra/terraform/modules/network` and `infra/terraform/modules/iam`), both composed and instantiated by a single root module (`infra/terraform/main.tf`) sharing a single remote S3 state backend with S3-native state locking (`use_lockfile = true`).

Key principles:
1. **Concern-based module separation**: Network resources (VPC, subnets, IGW, route tables, security groups) belong strictly in `modules/network`. IAM roles and policies (ECS execution role, task runtime role, VPC flow log role) belong strictly in `modules/iam`. IAM resources are never placed inside `modules/network`.
2. **Single root composition & state**: Neither child module declares its own `backend` or `provider` block. The root module in `infra/terraform/` calls both modules, creating a single plan/apply boundary and single state file in S3 (`taxpulse-tfstate-dev`).
3. **Explicit input/output wiring**: Cross-module dependencies are passed through output attributes (e.g. `module.iam.flow_log_role_arn` passed into `module.network`) and surfaced via root `outputs.tf` so future modules reference outputs rather than hardcoded literals.
4. **Resource vs. Data Source boundary**: Pre-existing infrastructure (such as availability zones `data.aws_availability_zones.available`) is queried using `data` blocks to avoid Terraform attempting to manage or destroy shared external resources. Genuinely new infrastructure is declared via `resource` blocks.
5. **Provider version pinning**: The AWS provider is pinned with `~> 6.0` in `versions.tf` to permit patch/minor updates while guarding against breaking major version shifts.

## Consequences
- **Single state file**: Running `terraform plan` or `terraform apply` from `infra/terraform/` evaluates the entire base infrastructure atomically.
- **Auditable change reviews**: All infrastructure diffs can be reviewed as unified pull requests prior to apply.
- **No literal duplication**: Subnet IDs and role ARNs are exported via outputs for downstream composition.
- **Safe state management**: S3-native locking (`use_lockfile = true`) prevents concurrent applies without requiring deprecated DynamoDB lock tables.
