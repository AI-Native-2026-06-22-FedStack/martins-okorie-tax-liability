# ADR-0023: IaC Scanning Policy

- Status: Accepted

## Context

TaxPulse infrastructure is now defined as Terraform code (ADR-0022). A misconfiguration in
the Terraform — a public S3 bucket, a security group open to the world, an unencrypted
volume — is cheapest to catch before it reaches AWS. Scanning the code at pull-request time
is the federal shift-left gate: the bad plan never applies, and the scan's machine-readable
output is evidence an auditor can read.

The scan findings map to NIST 800-53 controls RA-5 (vulnerability monitoring and scanning)
and SI-2 (flaw remediation), making "we scan and remediate misconfigurations" provable
rather than asserted.

## Decision

Run Checkov and Trivy (`trivy config`) on every Terraform plan from the very first commit.

### Scanning gate

1. **Checkov** scans the Terraform with graph-based checks that catch cross-resource issues
   (IAM edge cases, missing encryption, public access). Run with `--framework terraform`.
2. **Trivy** (`trivy config`) covers broad misconfiguration in one binary. It is the
   successor to the now-deprecated tfsec.
3. Running both is deliberate: Checkov's graph-based analysis and Trivy's broad
   misconfiguration coverage complement each other.
4. Both scanners emit **SARIF** (Static Analysis Results Interchange Format) to
   `artifacts/security/` for the audit packet.
5. The scanning gate exits non-zero on any policy violation, blocking the merge unless an
   ADR-justified skip covers the finding.

### Skip-justification rules

- A suppression without a written reason is banned.
- Every `# checkov:skip=CKV_*:<reason>` or `# trivy:ignore:<AVD-id>:<reason>` must carry:
  - The check ID
  - A specific, concrete reason
  - An entry in the skip-justification matrix below
- A bare skip with no reason does not merge.

### SARIF evidence

- Checkov SARIF: `artifacts/security/results_sarif.sarif`
- Trivy SARIF: `artifacts/security/trivy-results.sarif`
- Both files are the audit evidence for RA-5 and SI-2.

### Local execution

```bash
# Run the full scanning gate
bash terraform/scripts/scan.sh

# Or run individually
checkov -d terraform/ --framework terraform
trivy config terraform/
```

## Skip-Justification Matrix

| Check ID | Scanner | Resource | Reason | Date | Owner |
| -------- | ------- | -------- | ------ | ---- | ----- |
| CKV2_AWS_5 | Checkov | `aws_security_group.alb` | SG is defined now; ALB attachment comes in 8.2 Full-Stack Terraform | 2026-08-13 | Module engineer |
| CKV2_AWS_5 | Checkov | `aws_security_group.task` | SG is defined now; ECS task attachment comes in 8.2 Full-Stack Terraform | 2026-08-13 | Module engineer |
| CKV2_AWS_5 | Checkov | `aws_security_group.db` | SG is defined now; RDS/Postgres attachment comes in 8.2 Full-Stack Terraform | 2026-08-13 | Module engineer |
| CKV_AWS_130 / AVD-AWS-0164 | Checkov + Trivy | `aws_subnet.public` | Public subnets host the internet-facing ALB by design (ADR-0020); `map_public_ip_on_launch = true` is required for this tier | 2026-08-13 | Module engineer |
| AVD-AWS-0104 | Trivy | `aws_vpc_security_group_egress_rule.task_to_aws` | Tasks need outbound HTTPS (port 443) for AWS API calls (SecretsManager, DynamoDB, SNS, SQS); will be scoped to VPC endpoints in production | 2026-08-13 | Module engineer |
| CKV_AWS_111 / CKV_AWS_356 | Checkov | `aws_iam_role_policy.flow_log` | Flow log delivery role requires wildcard resource permissions to manage CloudWatch Log groups and streams dynamically | 2026-08-13 | Module engineer |
| CKV_AWS_158 | Checkov | `aws_cloudwatch_log_group.vpc_flow_log` | CloudWatch Log Group KMS encryption is not needed for development / local floci environment; will be enabled in production configurations | 2026-08-13 | Module engineer |

## Consequences

- Every Terraform PR is scanned before merge. A misconfiguration never reaches AWS.
- Justified exceptions are visible in the code (inline skip comment) and in this ADR
  (skip-justification matrix), so a reviewer can see that every suppression was a decision.
- SARIF output feeds code-scanning annotations on the PR and the compliance evidence sink.
- Adding a new scanner or custom policy check extends this gate without changing the
  workflow.

## Alternatives considered

**Scan only in CI, not locally** — developers would not see findings until the PR pipeline
runs, slowing the feedback loop. Local scanning catches issues before push.

**Single scanner (Checkov only or Trivy only)** — each scanner has blind spots. Running
both catches more misconfigurations at the cost of a few seconds of scan time.

**Suppress-everything approach** — suppressing all findings to ship a green scan defeats
the purpose. The skip-justification matrix and the "no bare skip" rule prevent this.
