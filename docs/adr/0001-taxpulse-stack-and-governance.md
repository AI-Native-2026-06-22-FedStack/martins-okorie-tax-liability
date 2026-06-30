# ADR-0001: TaxPulse Stack and Governance

## Status

Accepted

## Context

TaxPulse is a multi-tenant SaaS for wealth-advisor firms that computes a client's
real-time tax-liability calculation while an advisor models scenarios. The MVP needs a
small, auditable stack with strict data-handling rules, prompt-journal evidence, and
clear boundaries between application code and AI-generated assistance.

The repository instructions allow TypeScript with Express and Python with FastAPI.
They explicitly forbid Java, Spring, JPA, and MongoDB for TaxPulse. The MVP also limits
authentication scope to email and password with MFA and avoids tenant impersonation.

## Decision

Use TypeScript with Express and Python with FastAPI as the allowed application stack for
TaxPulse. Use Codex as an AI assistant only within the repository governance rules:
synthetic examples only, no secrets or controlled data in prompts or generated artifacts,
and prompt-journal entries for significant AI-assisted work.

Use Architecture Decision Records, pull request templates, and contributing guidance as
process documentation. Do not add build configuration as part of this documentation
scaffold.

## Consequences

- Positive: The allowed stack is narrow enough for consistent review, testing, and audit evidence.
- Positive: ADRs and prompt journals preserve the reasoning behind technical and AI-assisted work.
- Negative: Requests for Java, Spring, JPA, or MongoDB must be redirected to TypeScript/Express or Python/FastAPI.
- Negative: Process documentation adds review overhead, but keeps decisions traceable for future engineers and reviewers.
