# Week 8 · Day 4: The Secure-Release Gate

🕐 Last Updated: 2026-08-10 23:56:14 UTC
📌 Commit: [8db241a7](https://git.uptimecrew.com/wisam.naji/ai-native-curriculum/-/blob/8db241a7f8362f04b3aec11d0cef1344dbeef8d6/curriculum_fs/Module8/Lesson4/lesson.lms.md)

## Overview

Build the secure-release pipeline — Trivy container scanning, a Syft CycloneDX SBOM, Cosign keyless signing, and an OWASP ZAP DAST pass against the deployed staging URL — then do one real end-to-end deploy to an AWS sandbox with blue/green on ECS Fargate and a tested rollback runbook.

---

## Topic 1: Continuous delivery and the shape of the secure-release gate

### Why Do I Need to Know This?
In 8.3 The Secure-PR Gate you proved the source is clean before it merges. That gate says nothing about the artifact you ship: a pull request can be green and the image it builds can still carry a CRITICAL CVE in a base layer. The secure-release gate is a separate pipeline that runs after merge, and you need its shape — the order of the stages and what stops a bad release — before you wire any single stage.

This is the spine of the daily deliverable for this lesson: one reusable workflow that builds, scans, enumerates, signs, deploys, and tests the deployed app, with a red stage halting the release. Every later topic fills in one stage of this spine.

### Scenario
The team merged a clean PR last sprint and shipped the resulting image straight to staging. The image carried a CRITICAL CVE in its base layer that the PR gate never looked at — the PR gate scans source, not the built artifact. The fix is structural: add a release pipeline so an image cannot reach staging until it has been scanned, enumerated in a bill of materials, signed, deployed, and tested against its live URL.

### Theory
- **Delivery is a decision; deployment is automatic**: Continuous delivery keeps every change in a deployable state while leaving promotion to a person. Continuous deployment removes that person and ships every green change automatically.
- **The gate is a chain of stages, and any red stage stops the release**: The release gate is an ordered chain: build the image → Trivy scan → Syft SBOM → Cosign sign → deploy to staging → ZAP DAST → smoke test. Each stage depends on the one before it, so a failure anywhere halts the chain.
- **The smoke test is the last automated check before promotion**: Fast functional probe against the live staging URL (`GET /healthz`, expect 200).
- **It runs on merge, targeting staging first**: Triggered on push to `main`.

### The Secure-Release Stage Chain
```text
Merge to main
  ↓
Build image
  ↓
Trivy scan (0 CRITICAL, <=2 HIGH justified)
  ↓
Syft SBOM (CycloneDX)
  ↓
Cosign keyless sign (OIDC)
  ↓
Deploy to staging (ECS Fargate blue/green)
  ↓
ZAP DAST (staging URL, fail on Medium+)
  ↓
Smoke test (live URL /healthz)
  ↓
Promote to sandbox
```

---

## Topic 2: Supply-chain provenance — Trivy, the SBOM, and Cosign

### Why Do I Need to Know This?
A federal release has to answer three questions about the image it ships: what known vulnerabilities are in it, what every component inside it is, and whether it is the exact image you built. Trivy answers the first, a Syft SBOM answers the second, and Cosign answers the third. Together they are the supply-chain evidence an auditor expects, routed to `artifacts/security/`.

### Theory
- **Trivy scans the built image and gates on severity**: Enforces 0 CRITICAL and <=2 HIGH (each justified in ADR). Enforced with `--severity CRITICAL,HIGH --exit-code 1`.
- **The SBOM enumerates every component**: Syft generates CycloneDX format with `syft <image> -o cyclonedx-json=artifacts/security/sbom.cdx.json`.
- **Cosign proves provenance with keyless signing**: Reuses the OIDC identity via Sigstore Fulcio and Rekor transparency log. Verifies with `cosign verify --certificate-identity-regexp ... --certificate-oidc-issuer https://token.actions.githubusercontent.com`.

---

## Topic 3: DAST in CD — the OWASP ZAP baseline against the deployed URL

### Why Do I Need to Know This?
Trivy and SAST are static. DAST tests the app the way an attacker reaches it: over the network against the live staging URL.
- **OWASP ZAP baseline scan**: Fast, passive DAST safe to run on every release.
- **Gates promotion on Medium-or-above alerts**: Target live staging URL, `.zap/rules.tsv` for rule overrides (`IGNORE`/`WARN`/`FAIL`), `fail_action: true`.

---

## Topic 4: Blue/green on ECS Fargate and the rollback runbook

### Why Do I Need to Know This?
Rolling updates mutate the serving version in place. Blue/green stands the new version (green) up beside the old one (blue), health-checks it, shifts traffic across ALB target groups only when healthy, and flips back instantly on failure.
- **ECS Native Blue/Green**: Uses ALB with two target groups (`blue` and `green`) behind production listener rule.
- **Rollback Runbook (`docs/runbook-rollback.md`)**: Documents the fast path (traffic switch back to blue in seconds, not a redeploy), health verification (`/healthz` 200), and state reconciliation.

---

## Topic 5: Practice — ship the secure-release CD and do one real deploy

### Requirements:
1. Build reusable secure-release pipeline (`.github/workflows/release.yml` with chain of stages).
2. Trivy scan with `--severity CRITICAL,HIGH --exit-code 1` (0 CRITICAL, <=2 HIGH justified).
3. Syft CycloneDX SBOM generation to `artifacts/security/sbom.cdx.json`.
4. Cosign keyless signing via OIDC.
5. ECS Fargate blue/green deployment behind ALB with two target groups.
6. ZAP baseline scan against staging URL with `fail_action: true` and `.zap/rules.tsv`.
7. Smoke test against staging URL (`GET /healthz`).
8. Route all reports to `artifacts/security/`.
9. Author rollback runbook in `docs/runbook-rollback.md`.
10. Draft ADR-0025 (Container scanning policy) and ADR-0026 (DAST policy).
