# Week 8 Day 3 PR — The Secure-PR Gate

## Summary

This PR implements **Week 8 Day 3 — The Secure-PR Gate**, establishing a fully automated, mechanically non-bypassable GitHub Actions CI pipeline that enforces shift-left security across the TaxPulse repository. Every pull request is validated through keyless AWS OIDC authentication, polyglot SAST (Semgrep, ESLint-security, Bandit), SCA (OSV-Scanner), and full-history secret scanning (Gitleaks) before any change can merge to `main`.

### Key Changes

1. **GitHub Actions Secure-PR Workflow (`.github/workflows/secure-pr.yml`)**:
   - Configured `on: pull_request` trigger with tight baseline permissions (`id-token: write`, `contents: read`).
   - Structured parallel jobs matching branch protection required status checks: `build`, `tests`, `oidc-auth`, `sast`, `sca`, and `secrets`.
   - Preserves all scanner outputs (`artifacts/security/*`) as downloadable workflow evidence artifacts via `actions/upload-artifact@v4`.

2. **Keyless AWS Authentication via OIDC (No Standing Secrets)**:
   - Eliminated `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from repository secrets and workflow code.
   - CI assumes the IAM role via short-lived GitHub OIDC tokens exchanged through `aws-actions/configure-aws-credentials@v4` using `role-to-assume: ${{ vars.AWS_ROLE_ARN }}`.
   - Authored IAM trust policy template (`aws/github-oidc-trust-policy.json`) conditioned on immutable numeric claims:
     - `token.actions.githubusercontent.com:aud`: `sts.amazonaws.com`
     - `token.actions.githubusercontent.com:repository_owner_id`: `293999841`
     - `token.actions.githubusercontent.com:repository_id`: `<your-repo-id>`
   - Numeric claims protect against immutable subject claim format changes (`repo:org@<id>/repo@<id>:...`) and isolate role assumption across repositories in shared AWS accounts.

3. **Polyglot SAST Across Node and Python Services**:
   - **Cross-Language Semgrep CE**: Configured rule packs (`p/ci`, `p/owasp-top-ten`) plus custom rule `.semgrep/no-pii-in-logs.yml` at `severity: ERROR` preventing plaintext `taxpayerId` or PII disclosure to loggers. Validated with `semgrep --validate`.
   - **Node/Express Core Case Service (`apps/api`)**: Integrated `eslint-plugin-security` and `eslint-plugin-no-secrets` into `eslint.config.js`. Fixed true-positive in `apps/api/src/auth/mfa.ts` (`createDecipheriv` now specifies `{ authTagLength: 16 }` against GCM tag truncation).
   - **Python Tax Engine (`services/compute`)**: Configured Bandit scanning excluding tests (`-x services/compute/tests -lll`) and emitting SARIF evidence to `artifacts/security/bandit-results.sarif`.

4. **SCA (OSV-Scanner)**:
   - Scans dependency lockfiles (`package-lock.json`, `uv.lock`) against the OSV.dev database.
   - Emits standardized JSON vulnerability report to `artifacts/security/osv-scanner-results.json`.

5. **Secret Scanning & Failing-then-Fixed Gitleaks Regression**:
   - Configured full-history Gitleaks scan with `fetch-depth: 0` so past commits are scanned.
   - Added `.gitleaks.toml` (allowlists for test fixtures/documentation), `.gitleaksignore` (justified fingerprints), and `scripts/pre-commit-gitleaks.sh` (local pre-commit hook).
   - Empirically proved gate blocking behavior in `evidence/gitleaks-regression.md`:
     - **RED State**: Planted high-entropy GitHub PAT in `apps/api/src/config/secret-regression-test.ts` failed the gate with exit code 1.
     - **GREEN State**: Rotated credential at origin, replaced with `process.env.REGRESSION_API_KEY`, logged disposition `DISP-0002`, and added fingerprint to `.gitleaksignore` to return exit code 0.
     - Proved that deleting a commit alone does not un-leak a credential; rotation and justified triage are required.

6. **Governance & Documentation**:
   - Authored `ADR-0024: Secure-PR Gate Matrix and Non-Bypassable Enforcement Policy` in `docs/adr/0024-secure-pr-gate-matrix.md`.
   - Authored `Security Finding Disposition Log` in `docs/security/disposition-log.md` cataloging all triaged findings (`DISP-0001` through `DISP-0006`).
   - Maintained prompt journal entries in `prompt-journal/0033-the-secure-pr-gate.md` (Entries 1–4).

---

## Required Status Checks Matrix (ADR-0024)

| Check Name | Target Scope | Mode | Failure Threshold | Evidence Destination |
| :--- | :--- | :---: | :--- | :--- |
| **`oidc-auth`** | AWS STS Token Exchange | **BLOCK** | Any auth failure / stored key | STS caller identity in workflow log |
| **`build`** | TypeScript Workspace | **BLOCK** | Any compiler / type error | Build logs |
| **`tests`** | Unit & Integration Test Suites | **BLOCK** | Any test failure | Test suite logs |
| **`sast`** | Semgrep, ESLint-Security, Bandit | **BLOCK** | `ERROR` / `HIGH` severity finding | `artifacts/security/semgrep-results.sarif`, `bandit-results.sarif`, `eslint-security-results.json` |
| **`sca`** | OSV-Scanner | **BLOCK** | Known-exploited CVE (CISA KEV) / Direct Critical | `artifacts/security/osv-scanner-results.json` |
| **`secrets`** | Gitleaks (Full History) | **BLOCK** | Any unsuppressed secret / key | `artifacts/security/gitleaks-results.json` |

---

## Security Verification Evidence

### 1. Semgrep Custom Rule Precision Testing
```bash
# Validate rule syntax
$ semgrep --validate --config .semgrep/
Configuration is valid - found 0 configuration error(s), and 1 rule(s).

# Test against known-bad snippet (fires at ERROR)
$ semgrep scan --config .semgrep/ /tmp/bad.ts --error
Ran 1 rule on 1 file: 1 finding (1 blocking).
Exit code: 1

# Test against known-good snippet (passes silently)
$ semgrep scan --config .semgrep/ /tmp/good.ts --error
Ran 1 rule on 1 file: 0 findings.
Exit code: 0
```

### 2. Node ESLint-Security & Python Bandit Execution
```bash
# Node Core Case Service
$ npx eslint apps/api/src
✖ 11 problems (0 errors, 11 warnings) # 0 blocking errors

# Python Tax Engine
$ uv run bandit -r services/compute -x services/compute/tests -lll
Test results: No issues identified. (0 High findings)
```

### 3. Gitleaks Regression Evidence
```bash
# 1. Failing Commit (RED)
$ gitleaks detect --config .gitleaks.toml --source apps/api/src/config/secret-regression-test.ts --no-git --verbose
Finding: ...EGRESSION_GH_PAT = "ghp_U7zKqM8vN2pL9wX4yT1rQ6sB3cE5aG0dF2jH";
RuleID: github-pat
Exit code: 1

# 2. Rotated & Suppressed Fix (GREEN)
$ gitleaks detect --config .gitleaks.toml --gitleaks-ignore-path .gitleaksignore --verbose
133 commits scanned.
no leaks found.
Exit code: 0
```

### 4. Evidence Artifacts Produced in `artifacts/security/`
```text
artifacts/security/
├── bandit-results.json
├── bandit-results.sarif
├── gitleaks-results.json
├── osv-scanner-results.json
├── results_cli.txt
├── results_sarif.sarif
├── semgrep-results.sarif
└── trivy-results.sarif
```

---

## AI Pair Programming & Prompt Journal

All interactions and verifications are recorded in [`prompt-journal/0033-the-secure-pr-gate.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/prompt-journal/0033-the-secure-pr-gate.md):
- **Entry 1**: Helper file initialization (`helper/week-8-day-3-the-secure-pr-gate.md`) and prompt journal setup.
- **Entry 2**: Authored `.github/workflows/secure-pr.yml` with keyless OIDC authentication and created `aws/github-oidc-trust-policy.json`.
- **Entry 3**: Wired SAST, SCA, full-history Gitleaks, executed failing-then-fixed regression, and created disposition log.
- **Entry 4**: Codified non-bypassable branch protection gate matrix in `ADR-0024` with downloadable SARIF/JSON evidence bundles.
