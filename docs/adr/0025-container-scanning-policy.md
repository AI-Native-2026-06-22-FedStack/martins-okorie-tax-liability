# ADR-0025: Container Scanning and Vulnerability Gate Policy

## Status

Accepted

## Context

A green pull request passes static source analysis (SAST, SCA, linter, and secret scanners), but source-level verification does not guarantee the security of the built production container artifact. Base image layers, native system dependencies, compiled runtimes, and transitive binary distributions can introduce severe vulnerabilities (CVEs) that source scanners never inspect.

Federal compliance standards (NIST 800-53 RA-5, SA-11, SI-2, and FedRAMP Continuous Monitoring) require containerized services to undergo automated vulnerability scanning before deployment, enforce strict severity gating, enumerate all components in a machine-readable Software Bill of Materials (SBOM), and cryptographically sign and verify images to prevent tampering or unauthorized image replacement.

## Decision

We enforce container vulnerability scanning, SBOM generation, and cryptographic image signing within the post-merge release pipeline (`.github/workflows/release.yml`) for all production container images (including `taxpulse/core-case-service` and `taxpulse/tax-engine`).

### 1. Trivy Severity Gate Policy
- **Scanner**: Aquasec Trivy container scanner (`trivy image`).
- **Gating Execution**: Container scanning must execute with `--severity CRITICAL,HIGH --exit-code 1`. The `--exit-code 1` flag is strictly required to mechanically halt the release pipeline upon any unhandled blocking vulnerability.
- **Threshold**:
  - **CRITICAL Vulnerabilities**: Exactly **0 allowed**. Release cannot proceed if any CRITICAL CVE is detected.
  - **HIGH Vulnerabilities**: At most **2 allowed**, and **each HIGH must be explicitly bumped to a fixed version or justified line-by-line in this ADR and logged in the security disposition log**.
- **Evidence Destination**: Every scan emits standardized machine-readable SARIF (`artifacts/security/trivy.sarif`) and JSON (`artifacts/security/trivy.json`) artifacts for federal compliance auditability.

### 2. Software Bill of Materials (SBOM)
- Every release artifact must be enumerated using Anchore Syft producing a CycloneDX JSON SBOM:
  ```bash
  syft "$IMAGE_REF" -o cyclonedx-json=artifacts/security/sbom.cdx.json
  ```
- The SBOM is archived in `artifacts/security/` to accompany the release.

### 3. Keyless Image Signing and Verification
- **Keyless Signing via OIDC**: Container images are signed using Cosign (`cosign sign --yes "$IMAGE_REF"`) leveraging short-lived OIDC certificates minted by Sigstore Fulcio via GitHub Actions identity (`permissions: id-token: write`). No static, long-lived private signing keys are stored.
- **Pre-Deploy Verification Gate**: Before any deployment to staging or production, Cosign verifies the image against the Sigstore Rekor transparency log, strictly pinning both the OIDC issuer and signing identity:
  ```bash
  cosign verify \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    --certificate-identity "https://github.com/AI-Native-2026-06-22-FedStack/martins-okorie-tax-liability/.github/workflows/release.yml@refs/heads/main" \
    "$IMAGE_REF"
  ```
- If verification fails (e.g. an unsigned, tampered, or mismatched image reference), the release halts immediately.

## Exceptions & Justifications

Accepted risk owner: TaxPulse Module 8 Release Engineer, Martins Okorie. Accepted for the pinned Debian 13 distroless container runtime.

| CVE | Package(s) | Severity | Status | Justification |
| :--- | :--- | :---: | :---: | :--- |
| `CVE-2026-14456` | `libssl3t64` (`3.5.6-1~deb13u2`) | HIGH | `fix_deferred` | Upstream Debian OpenSSL package vulnerability regarding unbounded memory growth in QUIC server handling. Pinned base image (`gcr.io/distroless/nodejs24-debian13:nonroot`) does not yet have an upstream Debian patch. The Core Case Service runs behind an ALB reverse proxy handling standard TLS 1.3 / HTTP/1.1 and does not expose raw QUIC/UDP server sockets. |

## Consequences

- **Strict Gating**: No image with unaddressed CRITICAL vulnerabilities or unjustified HIGH vulnerabilities can proceed to deployment. Dropping `--exit-code 1` is prohibited.
- **Audit Traceability**: CycloneDX SBOM and Trivy SARIF reports are archived under `artifacts/security/` for compliance traceability.
- **Rekor Transparency Log Publication**: Keyless OIDC signing publishes the signing certificate and identity—including the workflow path and repository name (`AI-Native-2026-06-22-FedStack/martins-okorie-tax-liability`)—to Sigstore Rekor, a public, immutable, append-only transparency log. This record cannot be edited or deleted. This permanence is the intended architectural mechanism that keeps image signatures verifiable even after the short-lived OIDC certificate expires. This public visibility trade-off is accepted knowingly.
