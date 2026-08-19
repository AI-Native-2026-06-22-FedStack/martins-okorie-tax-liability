# Security Finding Disposition Log

This log records every security finding identified across SAST (Semgrep, ESLint-security, Bandit), SCA (OSV-Scanner), and Secret Scanning (Gitleaks).
Under the TaxPulse security policy, no HIGH/ERROR finding may merge unaddressed; every finding must be **Fixed (True Positive)**, **Documented False Positive**, or **Tracked Remediated**.

---

## Log Entries

### DISP-0001: Node Crypto GCM Missing Authentication Tag Length
- **Tool**: Semgrep CE (`javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length`)
- **Location**: `apps/api/src/auth/mfa.ts:39`
- **Severity**: HIGH / ERROR
- **Disposition**: **Fixed (True Positive)**
- **Rationale**: `crypto.createDecipheriv` without explicit `authTagLength` options allows potential shorter-tag forgery under Galois/Counter Mode (GCM).
- **Remediation**: Updated `createDecipheriv` call to pass `{ authTagLength: 16 }` enforcing a 16-byte authentication tag.

### DISP-0002: Planted GitHub PAT Test Credential (M8D3 Secure-PR Gate Regression)
- **Tool**: Gitleaks (`github-pat`)
- **Location**: `apps/api/src/config/secret-regression-test.ts:2`
- **Severity**: HIGH / BLOCKING
- **Disposition**: **Rotated & Documented False Positive**
- **Rationale**: Planted synthetic token `ghp_U7zKqM8vN2pL9wX4yT1rQ6sB3cE5aG0dF2jH` used to verify that the Gitleaks gate blocks PR merge when a credential is present.
- **Remediation**: Credential was immediately invalidated/rotated, removed from active source code in favor of `process.env.REGRESSION_API_KEY`, and fingerprint was suppressed in `.gitleaksignore` with documented justification. Removing the commit alone does not un-leak a credential — rotation is required.

### DISP-0003: Synthetic RSA Private Key in Compute Service Test Fixtures
- **Tool**: Gitleaks (`private-key`)
- **Location**: `services/compute/tests/fixtures/jwt_keys/private.pem`
- **Severity**: MEDIUM / WARNING
- **Disposition**: **Documented False Positive**
- **Rationale**: Fictional RSA private key generated solely for offline test token signing during unit and contract tests in `services/compute/tests/`. No access to production or live AWS resources is granted.
- **Remediation**: Path allowlisted in `.gitleaks.toml` under `tests?/fixtures/`.

### DISP-0004: Synthetic Test TOTP Secrets in Authentication Attack Suites
- **Tool**: Gitleaks (`generic-api-key`)
- **Location**: `apps/api/test/auth/auth.attacks.test.ts`
- **Severity**: LOW / WARNING
- **Disposition**: **Documented False Positive**
- **Rationale**: Test secret strings (`US6XJ552V3R4T75W`) used to exercise MFA replay and invalid token attack rejection suites.
- **Remediation**: Path allowlisted in `.gitleaks.toml` under `apps/api/test/`.

### DISP-0005: CloudFront Localhost URL String Entropy Flagged by No-Secrets
- **Tool**: ESLint (`no-secrets/no-secrets`)
- **Location**: `apps/api/src/config/cors.ts`, `apps/api/src/config/env.ts`
- **Severity**: LOW / WARNING
- **Disposition**: **Documented False Positive**
- **Rationale**: High-entropy string `http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566` is a local floci/LocalStack mock CloudFront distribution domain, not an actual secret.
- **Remediation**: Added regex ignore pattern in `eslint.config.js`.

### DISP-0006: Python Bandit B110 Try-Except-Pass in Auth Validation
- **Tool**: Bandit (`B110: try_except_pass`)
- **Location**: `services/compute/app/auth.py:162`
- **Severity**: LOW
- **Disposition**: **Tracked**
- **Rationale**: Fallback token decoding attempt gracefully catches decoding failures and returns boolean validation status without crashing the process. No HIGH findings reported across Python services.

### DISP-0007: Distroless Base OpenSSL QUIC DoS in Container Scan
- **Tool**: Trivy (`CVE-2026-14456`)
- **Location**: `libssl3t64:3.5.6-1~deb13u2` in `taxpulse/core-case-service:v1.0.0.0`
- **Severity**: HIGH
- **Disposition**: **Documented False Positive / Accepted Risk (ADR-0025)**
- **Rationale**: Upstream Debian 13 base library finding in OpenSSL QUIC server protocol implementation with `fix_deferred` status. The Core Case Service runs behind an AWS Application Load Balancer terminating standard TLS 1.3 / HTTP/1.1 and does not bind or process raw UDP/QUIC traffic.
- **Remediation**: Documented in ADR-0025. Accepted base exception adhering to 0 CRITICAL and <=2 HIGH container gate policy; to be retired once patched distroless base digest is released.

