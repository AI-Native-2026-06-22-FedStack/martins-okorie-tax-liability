# Prompt Journal: The Secure-PR Gate

## Entry 1

Asked — Save the Week 8 Day 3 "The Secure-PR Gate" lesson content as a helper reference file and create a new prompt journal.

Produced — Saved `helper/week-8-day-3-the-secure-pr-gate.md` with the full lesson covering all five topics (GitHub Actions fundamentals and OIDC to AWS with short-lived credentials and no stored keys, SAST across Semgrep with custom rules, ESLint-security, and Bandit, SCA via OSV-Scanner and Dependabot, secret scanning via full-history Gitleaks and pre-commit hooks, and assembling the gate with required status checks, SARIF evidence in dual destinations, and ADR-0024) and initialized `prompt-journal/0033-the-secure-pr-gate.md` as the next sequential prompt journal.

Accepted or rejected — Accepted.

Why — The lesson reference material has been cleanly saved in the helper directory and the prompt journal is initialized for tracking secure-PR gate implementation entries.

## Entry 2

Asked — Author the GitHub Actions secure-PR workflow (.github/workflows/secure-pr.yml) triggered on pull_request with tight baseline permissions (id-token: write, contents: read), configure keyless AWS OIDC authentication via role-to-assume referencing ${{ vars.AWS_ROLE_ARN }} without long-lived credentials, create the numeric-claim scoped IAM trust policy template (aws/github-oidc-trust-policy.json), and document the security rationale and trust policy scoping.

Produced — Created `.github/workflows/secure-pr.yml` with the OIDC token exchange job verifying caller identity via `aws sts get-caller-identity`, enforced zero stored AWS keys, created `aws/github-oidc-trust-policy.json` conditioning on immutable numeric claims (`repository_owner_id: 293999841` and `repository_id`), and documented why numeric claims protect against subject claim format changes while isolating roles across repositories in a shared AWS account.

Accepted or rejected — Accepted.

Why — The keyless OIDC workflow and numeric-claim IAM trust policy template were created and validated with tight baseline permissions and zero stored access keys.

## Entry 3

Asked — Wire SAST (Semgrep with custom PII rule, ESLint-security for Node, Bandit for Python), SCA (OSV-Scanner), and full-history secret scanning (Gitleaks with fetch-depth: 0 and pre-commit hook) into the secure-PR gate, prove the secret scanner blocks with a failing-then-fixed Gitleaks regression, log all findings in the disposition log, and emit SARIF/JSON to the security evidence sink.

Produced — Authored custom Semgrep rule `.semgrep/no-pii-in-logs.yml` and verified with `semgrep --validate` against known-bad and known-good snippets; configured ESLint with `eslint-plugin-security` and `eslint-plugin-no-secrets` for `apps/api/`; configured Bandit with SARIF output for `services/compute/`; integrated OSV-Scanner for dependency scanning; configured `.gitleaks.toml`, `.gitleaksignore`, and `scripts/pre-commit-gitleaks.sh`; fixed true-positive crypto tag length vulnerability in `apps/api/src/auth/mfa.ts`; executed empirical red-then-green regression proving Gitleaks blocks on planted secrets and clears only after credential rotation and justified suppression; created `evidence/gitleaks-regression.md` and `docs/security/disposition-log.md`; and populated SARIF/JSON evidence files in `artifacts/security/`.

Accepted or rejected — Accepted.

Why — The complete scanning suite was verified locally and integrated into the PR workflow, the Semgrep custom rule precision was confirmed against test snippets, the Gitleaks blocking-and-rotation lifecycle was empirically proven, and all findings were triaged in the disposition log.

## Entry 4

Asked — Make the secure-PR scanners non-bypassable required status checks on main (build, tests, SAST, SCA, secrets), ensure every scanner report is retained under artifacts/security/ as downloadable workflow evidence, and write ADR-0024 (docs/adr/0024-secure-pr-gate-matrix.md) recording the block-versus-warn gate matrix and justification policy.

Produced — Authored `docs/adr/0024-secure-pr-gate-matrix.md` in MADR format detailing the exact policy posture for each status check (`oidc-auth`, `build`, `tests`, `sast`, `sca`, `secrets`), failure thresholds, artifact evidence mappings, and the zero-bare-suppression policy; structured `.github/workflows/secure-pr.yml` with discrete parallel jobs aligned with branch protection required checks; and wired SARIF and JSON artifact retention via `actions/upload-artifact@v4`.

Accepted or rejected — Accepted.

Why — The mechanical branch protection matrix and federal evidence retention rules were codified in ADR-0024 and aligned with the GitHub Actions workflow jobs.

## Entry 5

Asked — Document the branch-protection platform limitation on private repositories under the GitHub Free plan per reviewer feedback before merging.

Produced — Updated `docs/adr/0024-secure-pr-gate-matrix.md` and `review/m8d3-pr-description.md` with a dedicated "Platform Limitation Note: GitHub Free Plan Branch Protection API" section documenting the exact `gh api repos/:owner/:repo/branches/main/protection` HTTP 403 Forbidden response (`Upgrade to GitHub Pro or make this repository public to enable branch protection rules`) and the two remediation options (make repository public or upgrade organization account) to ensure reviewers and auditors do not mistake workflow gate configuration for live native API enforcement.

Accepted or rejected — Accepted.

Why — The GitHub platform plan limitation and its exact API error response and remediation paths were explicitly documented in ADR-0024 and the PR description to provide clear audit transparency.




