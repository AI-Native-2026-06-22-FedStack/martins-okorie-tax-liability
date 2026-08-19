# Prompt Journal: 0034 The Secure-Release Gate

## Entry 1

### Asked

Initialize the Week 8 Day 4 deliverable for "The Secure-Release Gate", save the lesson reference text in `helper/`, start a new prompt journal, and scaffold the review PR description.

### Produced

1. Saved full lesson syllabus and requirements to `helper/week-8-day-4-the-secure-release-gate.md`.
2. Initialized `prompt-journal/0034-the-secure-release-gate.md` tracking all subsequent steps.
3. Created initial PR review scaffold at `review/m8d4-pr-description.md`.

### Accepted or rejected

Accepted

### Why

The deliverable assets, helper reference, prompt journal, and review description template were cleanly initialized on branch `m8d4-implementation` in full accordance with `AGENTS.md` and repository standards.

## Entry 2

### Asked

Verify all prerequisites for Week 8 Day 4 (Trivy, Syft, Cosign, OWASP ZAP, AWS CLI, Docker, floci emulator, real-AWS auth with sandbox boundary, and repository workspace structure).

### Produced

1. Verified Trivy v0.73.0 with vulnerability database initialized.
2. Installed and verified Syft v1.51.0 (CycloneDX SBOM 1.6 generator) and Cosign v3.1.3 (OIDC keyless container signing) via Homebrew.
3. Verified AWS CLI v2.35.9 (supporting `aws login` and `AWS_ENDPOINT_URL`).
4. Verified Docker.app presence and workspace repository assets (`apps/api`, `services/compute`, `infra/terraform/`, `artifacts/security/`, `docs/security/disposition-log.md`, `docs/adr/`, `prompt-journal/`).

### Accepted or rejected

Accepted

### Why

All required container scanning, SBOM generation, image signing, and deployment tooling were verified and installed to satisfy the Week 8 Day 4 secure-release prerequisites.

## Entry 3

### Asked

Execute the bootstrap smoke test verifying Trivy, Syft, Cosign, AWS CLI targeting floci on port 4566, non-mock ECS mode, codebase presence, evidence sink, and required directory creation (`.zap`, `docs/adr`, `infra/terraform/modules/observability`).

### Produced

1. Executed and confirmed Trivy v0.73.0, Syft v1.51.0, Cosign v3.1.3, and AWS CLI v2.35.9.
2. Started local floci emulator container and verified STS reachability (`http://localhost:4566`).
3. Confirmed `FLOCI_SERVICES_ECS_MOCK` is false.
4. Verified presence of `apps/api`, `services/compute`, and `artifacts/security`.
5. Created target directories `.zap`, `docs/adr`, and `infra/terraform/modules/observability`.

### Accepted or rejected

Accepted

### Why

The full bootstrap smoke test succeeded with all local release toolchains, emulator endpoints, and repository directory structures verified.

## Entry 4

### Asked

Implement supply-chain provenance for Task 1: add the three provenance artifacts (Trivy container scan with severity gating, Syft CycloneDX SBOM enumeration, and Cosign keyless OIDC signing and pre-deploy verification) to the release pipeline, document the container-scanning policy in ADR-0025, triage findings in the disposition log, and emit evidence into `artifacts/security/`.

### Produced

1. Created `.github/workflows/release.yml` with a sequential gated chain (`build` → `scan` → `sbom` → `sign` → `deploy` → `assert-target` → `dast`).
2. Updated `.github/workflows/cosign-sign.yml` to enforce keyless OIDC signing and verification pinning both OIDC issuer and workflow identity on `main`.
3. Created `docs/adr/0025-container-scanning-policy.md` in MADR format defining the 0 CRITICAL / <=2 HIGH policy, `libssl3t64` base library justification, and Rekor public transparency log permanence implications.
4. Added `DISP-0007` to `docs/security/disposition-log.md` and updated `.trivyignore` with the documented exception.
5. Generated CycloneDX SBOM (`artifacts/security/sbom.cdx.json`), Trivy SARIF (`artifacts/security/trivy.sarif`), and Trivy JSON (`artifacts/security/trivy.json`) for `taxpulse/core-case-service:v1.0.0.0`.
6. Verified that `trivy image --severity CRITICAL,HIGH --exit-code 1` halts on unaddressed findings and exits clean once ADR-justified, and verified that Cosign rejects unsigned or mismatched images.

### Accepted or rejected

Accepted

### Why

The supply-chain provenance stage chain, Trivy severity gate, Syft CycloneDX SBOM generation, Cosign keyless signing/verification controls, ADR-0025 policy, and disposition logs were successfully implemented and empirically verified against the M7 Core Case Service container image.


