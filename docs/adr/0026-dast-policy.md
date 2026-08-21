# ADR-0026: Dynamic Application Security Testing (DAST) Policy

## Status

Accepted

## Context

Static security scanners (SAST, SCA, and container image linters) analyze code repositories and build layers, but they cannot evaluate the runtime security posture of the application as exposed across the network. Critical runtime vulnerabilities—such as missing Content Security Policies (CSP), absent clickjacking defenses (`X-Frame-Options`), missing MIME sniffing protections (`X-Content-Type-Options`), server fingerprint disclosures (`X-Powered-By`), insecure cache directives, or leaky error responses—only manifest when the live HTTP server is serving traffic.

Under federal compliance standards (NIST 800-53 RA-5, CA-7, and SA-11), releases must undergo continuous automated Dynamic Application Security Testing (DAST) against live deployment targets prior to production promotion.

## Decision

We enforce automated OWASP ZAP baseline scanning in continuous delivery (`.github/workflows/release.yml` and `.github/workflows/zap-baseline.yml`) against the live Core Case Service instance deployed on floci/AWS staging.

### 1. Mandatory Deployment & Target Liveness Assertion (`assert-target`)
- **Deploy First**: DAST requires an actively executing service. Scanning localhost before deployment or when no container is running produces zero alerts and generates a dangerous false-positive green release.
- **Loud Failure on Dead Target**: The `assert-target` stage sits strictly between `deploy` and `dast`. It probes the live endpoint (`curl -s -o /dev/null -w "%{http_code}" $TARGET_URL`) and fails the pipeline with a non-zero exit code if the endpoint does not return HTTP 200. This guarantees that a zero-alert ZAP result reflects a secure app rather than an unreachable target.

### 2. OWASP ZAP Baseline Mode & Severity Gate
- **Scan Mode**: OWASP ZAP Baseline Scan (`ghcr.io/zaproxy/zaproxy:stable`, passive scan, non-destructive, CI-friendly).
- **Severity Threshold**: **0 Medium-or-above alerts**.
  - The gate threshold is set at **Medium** because passive scans detect key web defenses (such as missing `Content-Security-Policy` and `X-Frame-Options` headers) as Medium severity. A High-only threshold would fail to catch essential header omissions.
  - `fail_action: true` is configured on the ZAP action, making any unaddressed Medium+ alert mechanically block the release.

### 3. Per-Rule Tuning (`.zap/rules.tsv`)
- Every alert category is governed by [`.zap/rules.tsv`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/.zap/rules.tsv):
  - **FAIL**: Core security defenses (CSP `10038`, Anti-clickjacking `10020`, MIME sniffing `10021`, HSTS `10035`, Information Disclosure `10037`) must remain set to `FAIL`.
  - **IGNORE**: Informational alerts may only be marked `IGNORE` if accompanied by a documented technical reason in the rules file and disposition log (e.g. Cache-Control `10049` on health endpoints, standard Unix timestamps in OpenAPI metadata `10096`, or CORS-isolated CORP `90004`).
  - No genuine Medium-or-above finding may be silenced to force a green build.

### 4. Audit Evidence Preserved in Sink
- Every run emits full HTML and JSON DAST reports to `artifacts/security/zap-report.html`, `artifacts/security/zap-report.json`, and `artifacts/security/staging-health-response.txt`.

## Consequences

- **Fail-Closed Release**: A missing security header or verbose error response halts the release pipeline immediately.
- **Dead-Target Protection**: Broken deployments or network routing faults cannot masquerade as clean scans; the release fails loudly at the assertion stage.
- **Audit Compliance**: Complete DAST evidence is archived for NIST 800-53 and FedRAMP compliance review.
