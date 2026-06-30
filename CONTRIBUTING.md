# Contributing to TaxPulse

TaxPulse uses small, reviewable changes with clear process evidence. Read
`AGENTS.md` and `docs/data-classification.md` before opening a branch or prompt.

## Branches

- Work from `main` and keep branches short-lived, ideally hours rather than days.
- Use descriptive branch names such as `docs/adr-scaffold`, `feat/tax-plan-cycle`, or
  `fix/tax-liability-rounding`.
- Do not push directly to `main`. Changes should land through pull requests with required checks.
- Rebase or merge from `main` frequently enough that the branch does not drift.

## Conventional Commits

Use Conventional Commits for every commit:

```text
type(optional-scope): concise subject
```

Common types:

- `feat`: new user-facing behavior.
- `fix`: bug fix.
- `docs`: documentation-only change.
- `test`: tests only.
- `refactor`: behavior-preserving code change.
- `chore`: maintenance that does not affect product behavior.

Examples:

```text
docs: scaffold ADR directory and contributing guide
feat(tax-plan-cycle): add review transition guard
fix(tax-liability): floor negative taxable income at zero
```

Use a `BREAKING CHANGE:` footer for backward-incompatible public API changes.

## Pull Requests

Keep pull requests small enough for a reviewer to hold in their head. Each PR should:

- Explain why the change exists, not just what changed.
- Link the governing ADR when a decision is being implemented.
- Include the checks or tests that were run.
- Avoid real client, tenant, credential, or controlled data in examples, logs, fixtures, and output.
- Update the prompt journal for significant AI-assisted work.

Reviewers should check:

- Correctness: the change does what the PR says, including edge cases.
- Security: the change does not leak data, weaken auth, or trust unvalidated input.
- Observability: errors and logs would help diagnose production behavior without exposing sensitive data.
- Tests: happy paths and relevant negative paths are covered.

## AI Assistance

AI output is a draft, not approval. Verify generated claims against the diff and the repo. Record
accepted, rejected, or pending AI-assisted work in the current prompt journal using the repo format.
