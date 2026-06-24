# TaxPulse Data Classification

TaxPulse handles data for wealth-advisor firms that use real-time tax-liability calculation while an advisor models scenarios for a client. This note defines what may be used in prompts, code examples, tests, fixtures, logs, and documentation.

## Classification Buckets

### PUBLIC

PUBLIC data is approved for broad disclosure. It may include public product language, public tax concepts, open-source package names, repository structure, and synthetic examples that are clearly fictional.

PUBLIC data may enter a prompt.

### CUI

CUI is controlled unclassified information. In TaxPulse, a client's taxpayer data and financial data is controlled. This includes tax identifiers, filing status, income, gains and losses, deductions, credits, account balances, holdings, transaction history, advisor notes about a client, and any tenant-specific data that can describe a real client, advisor, firm, or modeled tax outcome.

Real CUI must never enter a prompt.

### SBU

SBU is sensitive but unclassified operational data. It includes internal architecture details that are not public, vulnerability details, access-control decisions, deployment details, tenant configuration, audit evidence that names real systems, and any business-sensitive implementation notes.

Real SBU data must never enter a prompt.

## Bright Line

Synthetic or PUBLIC data may enter a prompt. Real CUI, real SBU, credentials, API keys, tokens, and secrets never do.

When an example is needed, use a clearly fictional synthetic fixture with no real identifiers. Do not transform real client, advisor, firm, tenant, taxpayer, or financial data into a prompt, even if it is summarized, masked, or partially redacted.

## Least Privilege

TaxPulse access must be granted with least privilege. Engineers, services, test runners, and automation should receive only the permissions required for the current task and only for the duration required. Default to read-only access for inspection work. Require explicit approval for actions that write outside the workspace, change production-like state, or expose data beyond the current repo boundary.

## No Secrets In Code

Secrets must not be committed, copied into prompts, stored in generated comments, embedded in tests, or written to logs. Use local environment variables or the approved secret store for runtime configuration.

Never commit artifacts such as:

- API keys
- Access tokens
- Refresh tokens
- Session cookies
- Private keys
- Certificates with private material
- Passwords
- `.env` files containing secrets
- Cloud provider credentials
- Database connection strings with credentials
- Service account JSON files

If a secret is accidentally exposed, stop using it, rotate it through the owning system, and remove it from git history according to the project's incident process.

## Self-Verify Checklist

Before starting TaxPulse work in Codex, a new engineer should verify:

- `AGENTS.md` is present and matches the TaxPulse project rules.
- `.codex/config.toml` sets `sandbox_mode = "workspace-write"` and `approval_policy = "on-request"`.
- No local `.env` file or credential artifact is staged for commit.
- `git status --short` does not show tokens, API keys, certificates, private keys, service account files, or secret-bearing config files.
- Any fixtures, tests, docs, prompts, or examples use clearly fictional synthetic data.
- The planned prompt contains only synthetic or PUBLIC data.
