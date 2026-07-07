# Contributing

TaxPulse uses trunk-based development, short-lived branches, Conventional Commits,
and reviewable pull requests. Before contributing, read the AI-assistant contract in
[AGENTS.md](AGENTS.md) and the data-classification posture in
[docs/data-classification.md](docs/data-classification.md).

## Branching

- Branch from `main`; do not push directly to `main`.
- Keep branches short-lived: one working day or less.
- Name branches as `<type>/<short-kebab-description>`.
- Allowed branch types are `feat`, `fix`, `docs`, `test`, `refactor`, and `chore`.
- Examples: `docs/contributing-guide`, `feat/tax-plan-cycle-review`,
  `fix/tax-liability-rounding`.
- Rebase or merge from `main` before opening a pull request if the branch has drifted.

## Commits

Use Conventional Commits for every commit:

```text
type(optional-scope): concise subject
```

Rules:

- Keep the subject under 72 characters.
- Use `feat` for new behavior and `fix` for bug fixes.
- Use `docs` for documentation-only work like this process scaffold.
- Use `test`, `refactor`, or `chore` only when the diff matches that type.
- Add a `BREAKING CHANGE:` footer for incompatible public API changes.

Examples:

```text
docs: scaffold ADR directory and contributing guide
feat(tax-plan-cycle): add review transition guard
fix(tax-liability): floor negative taxable income at zero
```

Confirm the type matches the diff before committing. A documentation change should not be
committed as `feat`, because release automation may treat it as new behavior.

## Pull requests

Pull requests must stay small, described, linked, and reviewable.

Size limits:

- Target 300 changed lines or fewer.
- Do not exceed 500 changed lines unless the PR description explains why the change cannot
  be split safely.

Every PR must:

- Explain why the change exists, not just what changed.
- Link the governing ADR when a technical decision is being implemented.
- Include the checks or tests that were run.
- Keep examples synthetic and follow [docs/data-classification.md](docs/data-classification.md).
- Follow [AGENTS.md](AGENTS.md) for allowed stack, AI-assistant use, and prompt journaling.
- Update the active prompt journal for significant AI-assisted work.

Reviewers should check:

- Correctness: the change does what the PR says, including edge cases.
- Security: the change does not leak data, weaken auth, or trust unvalidated input.
- Observability: errors and logs would help diagnose production behavior without exposing sensitive data.
- Tests: happy paths and relevant negative paths are covered.
