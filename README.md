# TaxPulse Tax Liability

TaxPulse is a multi-tenant SaaS for wealth-advisor firms that computes a client's real-time tax-liability calculation while an advisor models scenarios.

## Governance First

Before contributing, read:

- [AGENTS.md](AGENTS.md) for the repo-level Codex instructions, allowed stack, data-handling rules, and prompt-journal expectations.
- [docs/data-classification.md](docs/data-classification.md) for the PUBLIC, CUI, and SBU data rules that govern what may enter prompts, code, tests, logs, and docs.

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

## Current Toolchain

This repository currently contains governance documents and scaffold evidence only. When application code is added, use the stack allowed by [AGENTS.md](AGENTS.md): TypeScript with Express or Python with FastAPI.
