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

