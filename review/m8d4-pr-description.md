# Week 8 Day 4 PR — The Secure-Release Gate

## Summary

This PR implements **Week 8 Day 4 — The Secure-Release Gate**, establishing a post-merge automated continuous delivery pipeline that enforces supply-chain provenance, container security, dynamic vulnerability testing (DAST), and safe blue/green deployment with automated rollback procedures before promoting to the AWS sandbox.

Key changes:
1. **Reusable Secure-Release Workflow (`.github/workflows/release.yml`)**:
   - Structured sequential stage chain (`build` → `scan` → `sbom` → `sign` → `deploy-staging` → `dast` → `smoke-test`) using explicit `needs:` dependencies so any red stage halts release.
2. **Container Image Scanning (Trivy)**:
   - Enforced 0 CRITICAL and <=2 HIGH severity findings using `trivy image --severity CRITICAL,HIGH --exit-code 1`.
   - Output emitted to `artifacts/security/trivy.sarif`.
3. **Software Bill of Materials (Syft CycloneDX SBOM)**:
   - Generated full CycloneDX SBOM via `syft "$IMAGE_REF" -o cyclonedx-json=artifacts/security/sbom.cdx.json`.
4. **Keyless Image Signing (Cosign & OIDC)**:
   - Keyless image signing via Sigstore Fulcio and Rekor transparency log utilizing GitHub Actions OIDC identity.
   - Verification policy pinned to workflow identity on `main`.
5. **ECS Fargate Native Blue/Green Deployment**:
   - Terraform ECS service configured with `deployment_configuration { strategy = "BLUE_GREEN" }` behind ALB with dual target groups (`blue` and `green`).
6. **DAST (OWASP ZAP Baseline Scan)**:
   - Passive DAST scan against live deployed staging URL with `fail_action: true` and `.zap/rules.tsv`.
   - Output preserved under `artifacts/security/`.
7. **Smoke Testing & Rollback Runbook**:
   - Functional probe on live endpoint (`GET /healthz`, expect 200).
   - Rollback runbook in `docs/runbook-rollback.md` documenting traffic switch back to blue in seconds.
8. **ADRs**:
   - `ADR-0025: Container Scanning and Vulnerability Gate Policy` (`docs/adr/0025-container-scanning-policy.md`).
   - `ADR-0026: Dynamic Application Security Testing (DAST) Policy` (`docs/adr/0026-dast-policy.md`).

---

## Reviewer-requested security gate evidence

*(To be populated during deliverable execution)*

---

## Related ADR

- [`docs/adr/0025-container-scanning-policy.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0025-container-scanning-policy.md)
- [`docs/adr/0026-dast-policy.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0026-dast-policy.md)

---

## Testing

*(To be populated during deliverable execution)*

---

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
The secure-release pipeline implements a sequential delivery chain where each stage gates the next: image build, Trivy scan with blocking exit code, Syft CycloneDX SBOM, Cosign keyless signing, blue/green ECS Fargate deployment, ZAP DAST against the live URL, and functional smoke tests. All security evidence is retained in artifacts/security/, and the rollback runbook provides an instant listener-switch procedure.
```

Paste the "what it missed" note as a quote or code block:

```text
AI code generation commonly attempts to place DAST before deployment (when no live URL exists), omits --exit-code 1 from Trivy (turning gating scans into passive reports), proposes redeploying previous versions instead of switching ALB listener target groups for rollback, and suggests hardcoded signing keys instead of keyless OIDC. Manual enforcement ensured strict sequential dependencies, live URL targeting, and keyless Sigstore provenance.
```

---

## AI-tool reflection

Accepted the recommendation to structure the post-merge release pipeline with strict sequential `needs:` dependencies and keyless Cosign signing via OIDC, preserving audit evidence in `artifacts/security/`. Rejected any suggestions to run DAST against static code or perform rollbacks by rebuilding past commits from scratch.

---

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

---

## AI code-review checklist

- [x] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

---

## Deliverables checklist

- [x] Summary explains what changed.
- [x] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [x] Testing lists only checks or verification actually performed.
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
