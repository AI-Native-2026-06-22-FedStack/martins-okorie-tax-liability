# ADR-0023: IaC scanning policy and skip-justification matrix

## Status
Accepted

## Context
TaxPulse infrastructure is defined as versioned Terraform code (ADR-0022). Catching a misconfiguration (such as a public S3 bucket, an open security group, or unencrypted storage) in code prior to deployment is the federal shift-left principle. Scanning Terraform in CI on every pull request guarantees that insecure plans are blocked from ever being applied to AWS environments.

The scanning gate findings directly provide compliance evidence for NIST 800-53 controls:
- **RA-5 (Vulnerability Monitoring and Scanning)**: Continuous automated scanning of Infrastructure as Code artifacts.
- **SI-2 (Flaw Remediation)**: Enforcement that detected misconfigurations are remediated prior to merge or carry an explicit, audited justification.

## Decision
Enforce a mandatory Day-1 IaC scanning gate using both **Checkov** and **Trivy (`trivy config`)** on all Terraform configurations in `.github/workflows/iac-scan.yml`.

Scanning Rules & Evidence:
1. **Dual Scanner Enforcement**:
   - **Checkov**: Performs graph-based, cross-resource analysis for IAM edge cases, encryption, and bucket policies (`checkov -d infra/terraform/`).
   - **Trivy (`trivy config`)**: Performs broad misconfiguration checking across infrastructure parameters (`trivy config infra/terraform/`).
2. **Strict Gate Failure Threshold**:
   - The CI job exits with a non-zero status on any HIGH or CRITICAL policy violation, rendering un-remediated pull requests un-mergeable.
3. **SARIF Compliance Artifacts**:
   - Scanners emit machine-readable SARIF files (`artifacts/security/results_sarif.sarif` and `artifacts/security/trivy-results.sarif`) which are stored in the security evidence sink and attached to GitHub Actions workflow runs.
4. **Zero-Tolerance for Bare Skips**:
   - Every suppression must feature an inline HCL comment carrying the check ID, a specific justification, and an entry in the skip-justification matrix below. Bare `# checkov:skip` or `# trivy:ignore` comments without justification are forbidden.

## Skip-Justification Matrix

| Check ID | Scanner | Resource | Reason | Date | Owner |
| -------- | ------- | -------- | ------ | ---- | ----- |
| CKV2_AWS_5 | Checkov | `aws_security_group.alb` | Security group is defined in base network module; ALB resource attachment occurs in downstream composition | 2026-08-13 | TaxPulse DevSecOps |
| CKV2_AWS_5 | Checkov | `aws_security_group.task` | Security group is defined in base network module; ECS task resource attachment occurs in downstream composition | 2026-08-13 | TaxPulse DevSecOps |
| CKV2_AWS_5 | Checkov | `aws_security_group.db` | Security group is defined in base network module; Postgres DB attachment occurs in downstream composition | 2026-08-13 | TaxPulse DevSecOps |
| CKV_AWS_130 / AVD-AWS-0164 | Checkov + Trivy | `aws_subnet.public` | Public subnets host the internet-facing ALB tier by design (ADR-0020); `map_public_ip_on_launch = true` is required for ALB public ingress | 2026-08-13 | TaxPulse DevSecOps |
| AVD-AWS-0104 | Trivy | `aws_vpc_security_group_egress_rule.task_to_aws` | Fargate tasks require outbound HTTPS (port 443) to reach AWS API endpoints (SecretsManager, DynamoDB, SNS, SQS) or local floci emulator | 2026-08-13 | TaxPulse DevSecOps |
| CKV_AWS_111 / CKV_AWS_356 | Checkov | `aws_iam_role_policy.flow_log` | VPC flow log delivery role requires wildcard (`*`) resource permissions to dynamically create CloudWatch Log groups and streams | 2026-08-13 | TaxPulse DevSecOps |
| CKV_AWS_158 | Checkov | `aws_cloudwatch_log_group.vpc_flow_log` | Default CloudWatch Log Group encryption is acceptable for dev/floci test environment; KMS CMK encryption is enforced in prod | 2026-08-13 | TaxPulse DevSecOps |

## Consequences
- Un-remediated security misconfigurations fail PR builds and are blocked from merging.
- All suppressed rules are explicitly cataloged with operational context and audit references.
- SARIF evidence artifacts fulfill NIST 800-53 RA-5 and SI-2 evidence requirements.
