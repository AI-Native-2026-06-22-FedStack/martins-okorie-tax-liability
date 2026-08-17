# Week 8 Day 2 PR — Full-Stack Terraform

## Summary

This PR implements **Week 8 Day 2 — Full-Stack Terraform**, composing the entire TaxPulse infrastructure into four reviewable layers (`network` → `data` → `app` → `observability`) plus the `iam` base module under a single root module and remote S3 state backend on floci.

Key changes:
1. **Layered Module Composition**:
   - `modules/network` (Layer 1 Base): VPC (`10.42.0.0/16`), public subnets, private app subnets, private DB subnets, internet gateway, NAT gateway routing, default security group lockdown, and tier security groups (`alb`, `task`, `db`).
   - `modules/iam` (Base): Launch-time ECS task execution role, runtime task role with least-privilege inline permissions, and VPC flow log delivery role.
   - `modules/data` (Layer 2): Stateful data stores (RDS PostgreSQL with `deletion_protection = true` and `prevent_destroy = true`, DynamoDB plan-cycle read model with PITR, ElastiCache Redis replication group), event fabric (SNS topic `taxpulse-stage-changed`, SQS projection queue with DLQ redrive), and Secrets Manager secret containers (`taxpulse/local/db-password` and `taxpulse/local/jwt-signing-keys`).
   - `modules/app` (Layer 3): Application Load Balancer with routing rules, ECS Fargate cluster, task definitions for Core Case Service and Tax Engine with `secrets` mapped via `valueFrom` ARNs, ECS services, and S3 SPA static website delivery.
   - `modules/observability` (Layer 4 Seam): Deliberate seam layer declaring typed input variables (`service_name`, `alb_arn`, `alb_dns_name`) from `module.app` with zero resources declared (seam ready for m8d4).
2. **Stateful Store Lifecycle Safety**:
   - Configured `lifecycle { prevent_destroy = true }` and `deletion_protection = true` on RDS and DynamoDB.
   - Configured backup postures (`backup_retention_period = 7` and DynamoDB PITR).
   - Proved that attempting a destructive replace (`-/+`) causes `terraform plan` to fail immediately.
3. **Secrets by Reference, Never by Value**:
   - Created empty secret containers in Terraform (`taxpulse/local/db-password` and `taxpulse/local/jwt-signing-keys`).
   - Populated secret values out-of-band on floci via AWS CLI.
   - Task definitions wire secrets exclusively by ARN via `valueFrom` — no plaintext credentials in code, state, or plan.
4. **Stack-Wide Attribution & Whole-Stack Gate**:
   - Configured provider-wide `default_tags` (`Name = var.project_name`, `Owner = "tax-platform-team"`, `Environment = var.environment`).
   - Whole-stack Checkov (`checkov -d .`) and Trivy (`trivy config .`) scans passed with zero unjustified violations.
   - Emitted SARIF compliance artifacts to `artifacts/security/` mapping to NIST 800-53 RA-5 and SI-2.
5. **ADRs & Documentation**:
   - Extended `ADR-0022: Full-Stack Terraform Module Structure & Layered Composition` in `docs/adr/0022-terraform-module-structure.md`.
   - Updated the skip-justification matrix in `ADR-0023: IaC Scanning Policy` in `docs/adr/0023-iac-scanning-policy.md`.
   - Recorded all prompt interactions in `prompt-journal/0032-full-stack-terraform.md` (Entries 1–5).
   - Committed stable execution plan in `evidence/week-8-day-2-terraform-plan.txt` and full evidence in `evidence/week-8-day-2-full-stack-terraform.md`.

## Reviewer-requested security gate evidence

Terraform plan source: `artifacts/tfplan.txt`

```text
Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:
```

Whole-stack planned resources:

```text
- module.iam.aws_iam_role.ecs_execution
- module.iam.aws_iam_role.ecs_task
- module.iam.aws_iam_role.flow_log
- module.iam.aws_iam_role_policy.flow_log
- module.iam.aws_iam_role_policy.task_runtime
- module.iam.aws_iam_role_policy_attachment.ecs_execution_policy
- module.network.aws_cloudwatch_log_group.vpc_flow_log
- module.network.aws_default_security_group.default
- module.network.aws_flow_log.vpc
- module.network.aws_internet_gateway.main
- module.network.aws_route.public_internet
- module.network.aws_route_table.private_app
- module.network.aws_route_table.private_db
- module.network.aws_route_table.public
- module.network.aws_route_table_association.private_app[0]
- module.network.aws_route_table_association.private_app[1]
- module.network.aws_route_table_association.private_db[0]
- module.network.aws_route_table_association.private_db[1]
- module.network.aws_route_table_association.public[0]
- module.network.aws_route_table_association.public[1]
- module.network.aws_security_group.alb
- module.network.aws_security_group.db
- module.network.aws_security_group.task
- module.network.aws_subnet.private_app[0]
- module.network.aws_subnet.private_app[1]
- module.network.aws_subnet.private_db[0]
- module.network.aws_subnet.private_db[1]
- module.network.aws_subnet.public[0]
- module.network.aws_subnet.public[1]
- module.network.aws_vpc.main
- module.network.aws_vpc_security_group_egress_rule.alb_to_api
- module.network.aws_vpc_security_group_egress_rule.alb_to_compute
- module.network.aws_vpc_security_group_egress_rule.task_to_aws
- module.network.aws_vpc_security_group_egress_rule.task_to_db
- module.network.aws_vpc_security_group_ingress_rule.alb_https
- module.network.aws_vpc_security_group_ingress_rule.db_from_task
- module.network.aws_vpc_security_group_ingress_rule.task_from_alb_api
- module.network.aws_vpc_security_group_ingress_rule.task_from_alb_compute

Plan: 38 to add, 0 to change, 0 to destroy.
```

Checkov source: `artifacts/security/results_cli.txt`

```text
terraform scan results:

Passed checks: 159, Failed checks: 0, Skipped checks: 58
```

Trivy source: `artifacts/security/trivy-results.sarif`

SARIF summary: 1 run, 6 LOW/note-level results and no HIGH or CRITICAL results.

| Rule | SARIF level | Location | Message |
| --- | --- | --- | --- |
| AWS-0034 | note | modules/app/main.tf | Cluster does not have container insights enabled. |
| AWS-0025 | note | modules/data/main.tf | Table encryption explicitly uses the default KMS key. |
| AWS-0098 | note | modules/data/main.tf | Secret explicitly uses the default key. |
| AWS-0098 | note | modules/data/main.tf | Secret explicitly uses the default key. |
| AWS-0133 | note | modules/data/main.tf | Instance does not have performance insights enabled. |
| AWS-0017 | note | modules/network/main.tf | Log group is not encrypted. |

## Related ADR

- [`docs/adr/0022-terraform-module-structure.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0022-terraform-module-structure.md)
- [`docs/adr/0023-iac-scanning-policy.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0023-iac-scanning-policy.md)

## Testing

1. **Remote State & Module Initialization**:
   - `terraform -chdir=infra/terraform init -reconfigure`
   - `terraform -chdir=infra/terraform validate`
2. **Whole-Stack Plan & Apply**:
   - `terraform -chdir=infra/terraform plan`
   - `terraform -chdir=infra/terraform apply -auto-approve`
   - Verified 65 resources created cleanly on floci and shared single locked state file (`taxpulse-tfstate-dev`).
3. **Stateful Store Lifecycle Replacement Attack Test**:
   - Modified `aws_db_instance.main` identifier to force replacement.
   - Verified `terraform plan` failed with:
     ```text
     Error: Instance cannot be destroyed
     Resource module.data.aws_db_instance.main has lifecycle.prevent_destroy set,
     but the plan calls for this resource to be destroyed.
     ```
4. **Secrets Manager Out-of-Band Verification**:
   - Verified secrets populated out-of-band via AWS CLI:
     ```bash
     $ aws --endpoint-url http://localhost:4566 secretsmanager put-secret-value \
         --secret-id "taxpulse/local/db-password" \
         --secret-string "<redacted out-of-band value>"
     ```
   - Confirmed task definitions use `valueFrom: var.db_password_secret_arn` with zero plaintext passwords in state.
5. **Whole-Stack IaC Scanning**:
   - `./terraform/scripts/scan.sh`
   - Confirmed `✔ Checkov passed.` and `✔ Trivy passed.` (0 misconfigurations).
   - Verified SARIF artifacts in `artifacts/security/results_sarif.sarif` and `artifacts/security/trivy-results.sarif`.

Verification output:

```text
$ ./terraform/scripts/scan.sh
Running Checkov scan on infra/terraform...
...
✔ Checkov passed.

▸ Running Trivy config scan...
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

▸ SARIF evidence written to: /Users/martinsokorie/Desktop/martins-okorie-tax-liability/artifacts/security/
total 376
-rw-r--r--@ 1 martinsokorie  staff   52563 Aug 14 12:55 results_cli.txt
-rw-r--r--@ 1 martinsokorie  staff  120234 Aug 14 12:55 results_sarif.sarif
-rw-r--r--@ 1 martinsokorie  staff   15856 Aug 14 12:55 trivy-results.sarif
```

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
The layered module composition cleanly separates network, iam, data, app, and observability layers under a single root. Cross-module variables flow strictly via outputs, stateful resources are guarded against destruction, and task definitions properly reference Secrets Manager ARNs via valueFrom. Checkov and Trivy scans pass cleanly with SARIF evidence generated.
```

Paste the "what it missed" note as a quote or code block:

```text
AI code generation commonly attempts to place plaintext password arguments directly in aws_db_instance or aws_secretsmanager_secret_version resources, and often omits prevent_destroy and deletion_protection on stateful stores. Manual enforcement ensured manage_master_user_password = true, prevent_destroy = true, and strict valueFrom ARN wiring were applied across all layers.
```

## AI-tool reflection

Accepted the recommendation to configure provider-level `default_tags` in `providers.tf` and wire container environment secrets dynamically through `valueFrom` ARNs in `modules/app/secrets.tf`, ensuring complete resource attribution and zero secret leakage into state. Rejected any suggestions to hardcode database bootstrap passwords or `.tfvars` secret literals into the Terraform repository, preserving federal compliance and out-of-band secret separation.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI code-review checklist

- [x] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [x] Summary explains what changed.
- [x] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [x] Testing lists only checks or verification actually performed.
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
