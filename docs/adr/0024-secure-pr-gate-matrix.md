# ADR-0024: Secure-PR Gate Matrix and Non-Bypassable Enforcement Policy

## Status
Accepted

## Context
TaxPulse operates as an auditable multi-tenant SaaS application handling confidential taxpayer data and wealth advisory plans. Under federal compliance standards (NIST 800-53 RA-5, SA-11, SI-2, and IA-2), security scanning must be shift-left, automated, and mechanically non-bypassable. Human review or policy conventions alone are insufficient to prevent insecure code, leaked secrets, or vulnerable dependencies from entering the repository.

To enforce this, branch protection on `main` requires a set of automated GitHub Actions status checks triggered on every pull request (`.github/workflows/secure-pr.yml`). No pull request may merge unless all blocking status checks are green. Furthermore, all scanners must produce standardized machine-readable evidence (SARIF / JSON) preserved in `artifacts/security/` for audit accountability.

## Decision
We enforce a multi-layered Secure-PR gate with discrete parallel jobs, each assigned a strict policy posture (**BLOCK** vs. **WARN**), a failure threshold, and an evidence artifact sink.

### Gate Enforcement Matrix

| Check Name | Toolchain / Scanners | Target Scope | Mode | Failure Threshold | Evidence Output | Rationale |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **`oidc-auth`** | `aws-actions/configure-aws-credentials` | AWS STS Token Exchange | **BLOCK** | Any auth failure / long-lived key usage | STS caller identity in run log | Enforces keyless CI authentication via OIDC; zero standing credentials permitted. |
| **`build`** | TypeScript (`tsc`) | Workspace (`apps/*`, `packages/*`) | **BLOCK** | Any compiler or typecheck error | Build output logs | Prevents broken code and type regressions from merging. |
| **`tests`** | Vitest / Pytest | Node & Python Services | **BLOCK** | Any test failure | Test report logs | Ensures business logic, security guards, and regression suites pass. |
| **`sast`** | Semgrep CE, ESLint-Security, Bandit | Polyglot codebases (`apps/api`, `services/compute`, `.semgrep/`) | **BLOCK** | Any `ERROR` or `HIGH` severity finding (e.g. PII in logs, insecure crypto) | `artifacts/security/semgrep-results.sarif`, `bandit-results.sarif`, `eslint-security-results.json` | Cross-language and native static analysis blocks code-level vulnerabilities and disclosure bugs before merge. |
| **`sca`** | OSV-Scanner | Resolved dependencies (`package-lock.json`, `uv.lock`) | **BLOCK** | Any known-exploited CVE (CISA KEV) or direct dependency CRITICAL CVE | `artifacts/security/osv-scanner-results.json` | Blocks introduction of known vulnerable supply-chain packages against OSV.dev database. |
| **`secrets`** | Gitleaks (Full History + Pre-commit) | Git history (`fetch-depth: 0`) and active files | **BLOCK** | Any unsuppressed high-entropy secret, API key, token, or private key | `artifacts/security/gitleaks-results.json` | Zero tolerance for plaintext credentials in source code or git history. |

### Disposition and Suppression Policy
1. **Zero Bare Suppressions**:
   - Suppressing any finding without a justified reason is strictly forbidden.
2. **Disposition Logging**:
   - Every triaged finding must be recorded in [`docs/security/disposition-log.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/security/disposition-log.md) under one of three statuses:
     - `Fixed (True Positive)`: Code was modified to eliminate the vulnerability.
     - `Documented False Positive`: Tool triggered on synthetic test fixtures or mock domains; documented with specific fingerprint and regex allowlist.
     - `Tracked`: Informational or low-severity finding tracked for future sprint remediation.
3. **Secret Remediation by Rotation**:
   - Removing a commit containing a secret does not un-leak it. Any identified credential must be **rotated at its origin** before adding its fingerprint to `.gitleaksignore`.

## Empirical Verification
The mechanical enforcement of this gate was proven through the failing-then-fixed Gitleaks regression documented in [`evidence/gitleaks-regression.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/evidence/gitleaks-regression.md):
- **Red State**: A planted test credential caused Gitleaks to exit with code 1, halting PR merge.
- **Green State**: Once the credential was rotated, removed from active code, and its fingerprint documented in `.gitleaksignore` and `docs/security/disposition-log.md`, the gate returned code 0 and allowed merge.

## Consequences
- PR merges are mechanically gated by branch protection rules on `main`.
- All scanner outputs are archived in `artifacts/security/` as downloadable federal compliance evidence.
- Full auditability is maintained across all security tool findings and justifications.
