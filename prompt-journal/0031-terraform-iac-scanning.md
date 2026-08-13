# Prompt Journal: Terraform & IaC Scanning

## Entry 1

Asked — Save the Week 8 Day 1 "Terraform & IaC Scanning" lesson content as a helper reference file and create a new prompt journal.

Produced — Saved `helper/week-8-day-1-terraform-iac-scanning.md` with the full lesson covering all five topics (IaC reproducibility/audit/drift, Terraform building blocks, remote state with S3-native locking, Checkov + Trivy Day-1 gate with SARIF evidence, and the hands-on gated-base practice) and initialized `prompt-journal/0031-terraform-iac-scanning.md` as the next sequential prompt journal.

Accepted or rejected — Accepted.

Why — The lesson content is persisted in the helper directory for reference during implementation, and the prompt journal is ready for subsequent entries on the `m8d1-implementation` branch.

## Entry 2

Asked — Deploy a modularized Terraform foundation targeting local floci at `http://localhost:4566` with private S3 remote backend and S3-native state locking (`use_lockfile = true`), network and IAM base modules mapping M7 JSON definitions, restricted default security group, VPC flow logging to CloudWatch Logs, Checkov + Trivy Day-1 scan gate, and ADRs.

Produced — Created a root module calling child modules `network` and `iam`; bootstrapped the S3 state bucket and enabled native locking; restricted default security groups; configured VPC flow logging; added Checkov and Trivy inline skip comments inside resource blocks; wired scanning gate returning SARIF evidence; created ADR-0022 and ADR-0023; and recorded execution evidence.

Accepted or rejected — Accepted.

Why — The complete gated Terraform base configuration was successfully deployed to floci with 38 resources; static scanning passed without violations; verification proof of gate failure on seeded vulnerabilities was captured; and all compliance artifacts were written under the artifacts evidence directory.

## Entry 3

Asked — Initialize one Terraform root under `infra/terraform/` with remote state in S3 using S3-native locking (`use_lockfile = true`), separate network and IAM base modules without internal backends, pinned AWS provider (`~> 6.0`), and record ADR-0022.

Produced — Configured `infra/terraform/backend.tf` with remote S3 backend and `use_lockfile = true`, authored `infra/terraform/modules/network` and `infra/terraform/modules/iam` as separate concern-based modules, composed both in `infra/terraform/main.tf`, exposed outputs for cross-module wiring, and documented the architecture in `docs/adr/0022-terraform-module-structure.md`.

Accepted or rejected — Accepted.

Why — The root module and base modules under `infra/terraform/` were successfully authored, verified with terraform init and plan against floci, and recorded in MADR format under `docs/adr/0022-terraform-module-structure.md`.

## Entry 4

Asked — Wire the Checkov + Trivy config IaC scan gate, prove it fails on a seeded misconfiguration, generate SARIF evidence in `artifacts/security/`, and record ADR-0023 with a skip-justification matrix.

Produced — Created `.github/workflows/iac-scan.yml`, updated `terraform/scripts/scan.sh` to target `infra/terraform/`, seeded an unencrypted public S3 bucket with a public ACL to prove scan failure on `CKV_AWS_20` and `AVD-AWS-0092`, cleaned up the seeded resource, generated SARIF compliance evidence in `artifacts/security/`, and recorded the policy and skip-justification matrix in `docs/adr/0023-iac-scanning-policy.md`.

Accepted or rejected — Accepted.

Why — The dual scanner gate was verified to fail on seeded security violations, passed clean after remediation, emitted SARIF evidence mapping to NIST 800-53 RA-5/SI-2, and documented all justified suppressions in `docs/adr/0023-iac-scanning-policy.md`.



