# Week 8 Day 1 PR — Terraform & IaC Scanning

## Summary

This PR transitions the base infrastructure for TaxPulse from click-ops/imperative scripts to reviewable, versioned Infrastructure as Code (Terraform) backed by a remote S3 state backend on floci with S3-native locking (`use_lockfile = true`), and introduces a Day-1 Checkov + Trivy scanning gate.

Key changes:
1. **Terraform Root & Remote State**:
   - Configured `infra/terraform/backend.tf` with a remote S3 backend using S3-native state locking (`use_lockfile = true`, no DynamoDB table), bucket versioning, public access block, and server-side encryption.
   - Pinned Terraform version (`>= 1.11`) and AWS provider (`~> 6.0`) in `infra/terraform/versions.tf`.
   - Composed base modules in `infra/terraform/main.tf` and exposed outputs (`vpc_id`, subnet IDs, security group IDs, role ARNs) in `infra/terraform/outputs.tf`.
2. **Concern-Based Base Modules**:
   - Authored `infra/terraform/modules/network` managing the VPC (`10.42.0.0/16`), 2 public subnets, 2 private app subnets, 2 private DB subnets, Internet Gateway, route tables, VPC flow logging to CloudWatch Logs, and security groups (`alb`, `task`, `db`). Read existing AZs via `data "aws_availability_zones" "available"`.
   - Authored `infra/terraform/modules/iam` managing the launch-time execution role (`aws_iam_role.ecs_execution`), runtime task role (`aws_iam_role.ecs_task`) with least-privilege inline policy, and VPC flow log delivery role.
3. **IaC Security Scan Gate**:
   - Authored `.github/workflows/iac-scan.yml` running Checkov (`checkov -d infra/terraform/`) and Trivy (`trivy config infra/terraform/`) in CI, failing non-zero on policy violations.
   - Updated `terraform/scripts/scan.sh` to generate SARIF compliance evidence in `artifacts/security/results_sarif.sarif` and `artifacts/security/trivy-results.sarif` mapping to NIST 800-53 RA-5 (scanning) and SI-2 (remediation).
4. **ADRs & Documentation**:
   - Recorded `ADR-0022: Terraform module structure` in `docs/adr/0022-terraform-module-structure.md` continuing from ADR-0021.
   - Recorded `ADR-0023: IaC scanning policy and skip-justification matrix` in `docs/adr/0023-iac-scanning-policy.md`.
   - Appended prompt journal entries 3, 4, and 5 to `prompt-journal/0031-terraform-iac-scanning.md`.

## Related ADR

ADR:
- [`docs/adr/0022-terraform-module-structure.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0022-terraform-module-structure.md)
- [`docs/adr/0023-iac-scanning-policy.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0023-iac-scanning-policy.md)

## Testing

- `./terraform/scripts/bootstrap-state.sh`
- `aws --endpoint-url=http://localhost:4566 s3api get-bucket-versioning --bucket taxpulse-tfstate-dev`
- `aws --endpoint-url=http://localhost:4566 s3api get-public-access-block --bucket taxpulse-tfstate-dev`
- `aws --endpoint-url=http://localhost:4566 s3api get-bucket-encryption --bucket taxpulse-tfstate-dev`
- `cd infra/terraform && terraform init -reconfigure`
- `cd infra/terraform && terraform validate`
- `cd infra/terraform && terraform plan -out=tfplan`
- `cd infra/terraform && terraform apply "tfplan"`
- `cd infra/terraform && terraform state list`
- `cd infra/terraform && terraform plan`
- `checkov -d infra/terraform/ --framework terraform` (with seeded public bucket to prove failure)
- `trivy config infra/terraform/` (with seeded public bucket to prove failure)
- `./terraform/scripts/scan.sh`
- `ls -la artifacts/security/*.sarif`

Verification output:

```text
$ ./terraform/scripts/bootstrap-state.sh
▸ Creating state bucket: taxpulse-tfstate-dev
{
    "Location": "/taxpulse-tfstate-dev"
}
▸ Enabling versioning
▸ Blocking public access
▸ Enabling default encryption (AES256)
✔ State bucket taxpulse-tfstate-dev is ready.

$ aws --endpoint-url=http://localhost:4566 s3api get-bucket-versioning --bucket taxpulse-tfstate-dev
{
    "Status": "Enabled"
}

$ aws --endpoint-url=http://localhost:4566 s3api get-public-access-block --bucket taxpulse-tfstate-dev
{
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}

$ cd infra/terraform && terraform init -reconfigure
Initializing modules...
- iam in modules/iam
- network in modules/network
Initializing provider plugins found in the configuration...
- Finding hashicorp/aws versions matching "~> 6.0"...
- Reusing previous version of hashicorp/aws from the dependency lock file
- Using previously-installed hashicorp/aws v6.59.0

Initializing the backend...
Successfully configured the backend "s3"! Terraform will automatically
use this backend unless the backend configuration changes.

Terraform has been successfully initialized!

$ checkov -d infra/terraform/ --framework terraform (on seeded bad bucket)
Check: CKV_AWS_20: "S3 Bucket has an ACL defined which allows public READ access."
	FAILED for resource: aws_s3_bucket.seeded_public_bucket
	File: /seeded_bad_bucket.tf:2-4

Check: CKV2_AWS_6: "Ensure that S3 bucket has a Public Access block"
	FAILED for resource: aws_s3_bucket.seeded_public_bucket

Result: Checkov failed with exit code 1.

$ trivy config infra/terraform/ (on seeded bad bucket)
AWS-0092 (HIGH): Bucket has a public ACL: "public-read"
seeded_bad_bucket.tf:6-9 (aws_s3_bucket_acl.seeded_public_bucket_acl)

Result: Trivy failed with exit code 1.

$ ./terraform/scripts/scan.sh (after removing seeded bad bucket)
▸ Running Checkov...
✔ Checkov passed.

▸ Running Trivy config scan...
✔ Trivy passed.

Report Summary
┌─────────────────────────┬───────────┬───────────────────┐
│         Target          │   Type    │ Misconfigurations │
├─────────────────────────┼───────────┼───────────────────┤
│ .                       │ terraform │         0         │
├─────────────────────────┼───────────┼───────────────────┤
│ modules/network/main.tf │ terraform │         0         │
└─────────────────────────┴───────────┴───────────────────┘

▸ SARIF evidence written to: /artifacts/security/
results_sarif.sarif
trivy-results.sarif

$ cd infra/terraform && terraform plan -out=tfplan
Plan: 38 to add, 0 to change, 0 to destroy.

Saved the plan to: tfplan

$ cd infra/terraform && terraform apply "tfplan"
Apply complete! Resources: 38 added, 0 changed, 0 destroyed.

Outputs:
alb_security_group_id = "sg-76f81472e7fd4303b"
db_security_group_id = "sg-cb654e580bfbe6803"
execution_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-execution"
private_app_subnet_ids = ["subnet-6df2844c", "subnet-ce078d69"]
private_db_subnet_ids = ["subnet-3f972b79", "subnet-161197ad"]
public_subnet_ids = ["subnet-25cb927c", "subnet-e4406b58"]
task_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-task"
task_security_group_id = "sg-4543024d036cdf700"
vpc_id = "vpc-cbdddebc"

$ cd infra/terraform && terraform plan
No changes. Your infrastructure matches the configuration.

Terraform has compared your real infrastructure against your configuration
and found no differences, so no changes are needed.
```

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
Rubric result: Pass with 100% compliance across all 3 tasks.

- Remote state + locking on floci: backend.tf configures a private, versioned, encrypted S3 bucket with use_lockfile = true (no DynamoDB table). terraform init adopted the remote backend on floci without error, and concurrent apply attempts were blocked by S3-native state locking.
- Separate network + IAM modules: modules/network owns VPC/subnets and modules/iam owns execution/task roles. Neither child module declares its own backend. Owned resources use resource blocks, while pre-existing availability zones are queried via data "aws_availability_zones". ADR-0022 documents the module structure and shared state composition.
- IaC scan gate: Checkov and trivy config gate the Terraform via .github/workflows/iac-scan.yml and failed on a seeded public bucket (CKV_AWS_20 and AVD-AWS-0092). SARIF files land in artifacts/security/. All inline skips carry concrete reasons and entries in the ADR-0023 skip-justification matrix.
- Plan/apply discipline: terraform plan generated a reviewed plan (38 to add, 0 to change, 0 to destroy), applied cleanly to floci, and a subsequent re-plan confirmed zero drift ("No changes. Your infrastructure matches the configuration.").
```

Paste the "what it missed" note as a quote or code block:

```text
Initial AI proposals reached for the deprecated DynamoDB lock table pattern (dynamodb_table) for state locking. Human review caught that Terraform 1.11+ deprecates DynamoDB locking in favor of S3-native locking via use_lockfile = true, which was enforced across backend definitions.

The AI tool also initially omitted explicit inline skip justifications for security group definitions awaiting downstream attachment, suggesting bare # checkov:skip tags. Human review enforced the rule that every skip comment must carry a concrete reason pointing to ADR-0023, and cataloged all suppressions in the ADR-0023 skip-justification matrix.
```

## AI-tool reflection

I accepted Codex's suggestion to structure the root configuration under `infra/terraform/` with separate `backend.tf`, `versions.tf`, `variables.tf`, `main.tf`, and `outputs.tf` files, because separating these concerns makes the composition clean and allows child module outputs (subnet IDs, role ARNs) to be surfaced for downstream Lesson 2 composition. I rejected Codex's initial suggestion to include a DynamoDB lock table (`dynamodb_table`) in the S3 backend block, because Terraform 1.11+ deprecates DynamoDB state locking in favor of S3-native locking via `use_lockfile = true`. I also rejected any bare `# checkov:skip` comments without written justifications, enforcing inline explanation comments pointing directly to ADR-0023.

## PR routing

- Assignees: self-assign this PR (`martinsokorie`).
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
