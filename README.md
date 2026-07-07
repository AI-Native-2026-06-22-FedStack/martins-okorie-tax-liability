# Govern the AI Before You Code: Bootstrap the TaxPulse Repo

TaxPulse is a multi-tenant SaaS for wealth-advisor firms that computes a client's real-time tax-liability calculation while an advisor models scenarios.

## Governance First

Before contributing, read:

- [CONTRIBUTING.md](CONTRIBUTING.md) for the trunk-based workflow, branch naming, Conventional Commits, and PR review expectations.
- [AGENTS.md](AGENTS.md) for the repo-level Codex instructions, allowed stack, data-handling rules, and prompt-journal expectations.
- [docs/data-classification.md](docs/data-classification.md) for the PUBLIC, CUI, and SBU data rules that govern what may enter prompts, code, tests, logs, and docs.
- [docs/adr/README.md](docs/adr/README.md) for the Architecture Decision Record index.

The bright line is simple: synthetic or PUBLIC data may enter a prompt; real CUI/SBU data and secrets never do.

## Clean Clone Setup

From a clean workstation, initialize a governed Codex session with these steps:

1. Clone the repository.

   ```sh
   git clone https://github.com/AI-Native-2026-06-22-FedStack/martins-okorie-tax-liability.git
   cd martins-okorie-tax-liability
   ```

2. Confirm the required governance files are present.

   ```sh
   test -f AGENTS.md
   test -f docs/data-classification.md
   test -f .codex/config.toml
   ```

3. Review the repo instructions and data classification before opening a prompt.

   ```sh
   sed -n '1,220p' AGENTS.md
   sed -n '1,260p' docs/data-classification.md
   ```

4. Verify Codex is configured for workspace-scoped writes and approval for risky actions.

   ```sh
   grep -E '^(sandbox_mode|approval_policy|model_reasoning_effort)' .codex/config.toml
   ```

   Expected posture:

   ```toml
   model_reasoning_effort = "medium"
   sandbox_mode = "workspace-write"
   approval_policy = "on-request"
   ```

5. Confirm no secret-bearing files are staged or present for commit.

   ```sh
   git status --short
   git ls-files --others --exclude-standard
   ```

   Do not commit tokens, API keys, passwords, private keys, service account files, secret-bearing `.env` files, or credentials.

6. Start Codex from the repository root and keep prompts within the classification rules.

   ```sh
   codex
   ```

7. For significant AI-assisted work, append a sequential entry to `prompt-journal/0001-bootstrap.md`. Leave the `Why` field blank when the engineer has not yet provided acceptance reasoning.

## Python Package Setup

The Python starter package lives in `src/python/taxpulse_python/`, and the TypeScript scaffold lives in `src/typescript/`. The Python package is managed from the repository root with `uv`.

From a clean clone, recreate the Python 3.13 environment from the committed lock file:

```sh
uv sync --locked
```

## Toolchain Conventions

Use the documented check commands for each stack before opening a PR.

Node/TypeScript:

```sh
npm run check
npm run typecheck
npm test
```

Python/FastAPI:

```sh
uv sync --locked
make check
```

The Python `make check` target runs these gates in order and stops at the first failure:

```sh
uv run --locked ruff check src/python/taxpulse_python tests
uv run --locked mypy src/python/taxpulse_python tests
uv run --locked pytest
```

The allowed application stacks remain TypeScript with Express and Python with FastAPI, as defined in [AGENTS.md](AGENTS.md).

## API Drizzle Migrations

The API package uses Drizzle for TypeScript-first PostgreSQL schema work. Generated
migrations live in `apps/api/drizzle/`; the historical hand-written SQL migrations remain
in `apps/api/db/migrations/` as the Deliverable 1-2 record.

Drizzle does not create automatic down migrations. Rollback is a roll-forward repair:
generate a new, higher-numbered migration that corrects the database state. Do not edit an
applied migration, and do not add reverse migration files.
