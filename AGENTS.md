# TaxPulse Agent Instructions

## Project Purpose

TaxPulse is a multi-tenant SaaS for wealth-advisor firms that computes a client's real-time tax liability as advisors model scenarios.

## Project Scope

TaxPulse Advisory is built for independent RIAs, multi-family offices, and wealth-management firms that need auditable tax-liability planning for high-net-worth clients. The product replaces spreadsheet-driven planning with versioned, reviewable plan cycles where scenarios, assumptions, recommendations, client approvals, action items, and audit events are captured.

The primary case entity is a `Tax Plan Cycle`: one case per client and planning period, typically quarterly. A Tax Plan Cycle carries the client's income and deduction picture, modeled scenarios, the selected recommendation, action checklist, assigned owner, due date, priority, comments, attachments, immutable audit trail, and stage-transition log.

Tax Plan Cycles move through these workflow stages:

1. `Intake`: Cycle opened and client onboarding refreshed.
2. `Data Aggregation`: Income, deductions, and holdings are gathered through configured integrations or typed-in figures.
3. `Modeling`: Advisor builds 2-5 tax-liability scenarios.
4. `Review`: Firm Admin quality reviewer signs off on modeling assumptions and disclosure compliance, or sends the cycle back to the Advisor.
5. `Client Approval`: Advisor presents the recommendation while the cycle awaits client approval of action items.
6. `Executed`: Approved action items are tracked to completion.
7. `Archived`: Firm Admin closes and seals the cycle for compliance.

Do not add a separate case status field. The case condition is represented by the workflow stage. Use `on_hold` plus `hold_reason` for pauses independent of stage. Cases past `due_date` may show an overdue indicator, but the MVP does not include SLA timers, escalation routing, background jobs, or a separate overdue queue.

Internal firm roles are `Firm Admin` and `Advisor`. Firm Admin has full case, workflow, review, audit, reassignment, user-management, and close-and-seal authority. Advisor owns the client relationship, aggregates data, builds scenarios, submits for review, presents recommendations, manages client communications, and tracks action completion, but cannot review their own modeling or close and seal archived cycles.

External users have the `Client` role and use a portal scoped to their own data. Clients may view the plan cycle stage and scenarios, approve recommendations, mark action items complete, upload source documents, and message the advisor.

The platform `Admin` role is for TaxPulse vendor operations only. Do not model tenant impersonation in the MVP.

Authentication scope for the MVP is email and password with MFA for all internal and external users. Do not add SSO, SAML, OIDC, or magic-link flows unless the project scope is explicitly changed.

Workflow enforcement must gate stage transitions by role and current stage. Second-pair review is modeled as a normal role-gated transition with review permission, and denied transition attempts are recorded in the audit trail.

## Data Handling

Never place controlled data, client data, tenant data, credentials, API keys, tokens, or secrets in prompts, generated code comments, tests, logs, fixtures, documentation, or output. When an example is needed, substitute a synthetic fixture that is clearly fictional and contains no real identifiers.

## Language Standards and Pairing Conventions

The allowed application stack is TypeScript with Express and Python with FastAPI.

Refuse to generate or scaffold Java, Spring, JPA, or MongoDB code for TaxPulse. If a request asks for those technologies, explain that they are forbidden for this repo and offer an equivalent TypeScript/Express or Python/FastAPI implementation.

Use the repository's existing formatter and test commands when they are present. If a new toolchain area needs conventions, use Prettier for TypeScript/Express formatting, Black and Ruff for Python/FastAPI formatting and linting, Jest or Vitest for TypeScript tests, and pytest for Python tests. Prefer project scripts such as `npm test`, `npm run lint`, `npm run format`, `pytest`, `ruff check`, and `black --check` once they exist, and report any commands that cannot be run.

## TaxPulse Domain Vocabulary

Use `real-time tax-liability calculation` for the core computation. The calculation serves an `advisor` at a wealth-advisor firm and the advisor's `client`. Generated names, APIs, models, and tests should use this vocabulary instead of generic user/customer wording unless the code is describing platform authentication or tenancy.

# Prompt Journal Requirements

When assisting with project work, maintain a prompt journal entry for significant AI interactions.

For each entry, follow the concise structure used in `prompt-journal/0001-bootstrap.md`.

Continue adding entries to the current prompt journal file unless the engineer explicitly says to start a new journal file. When a new journal file is requested, start it at the next sequential `prompt-journal/000#-*.md` path. Within each prompt journal file, number entries sequentially in chronological order as `Entry 1`, `Entry 2`, `Entry 3`, and so on. Add each new entry after the previous one so the journal remains easy to scan.

Every prompt journal entry must include these four fields:

## Asked

A concise summary of the prompt submitted to Codex.

## Produced

A concise summary of Codex's response or generated output.

## Accepted or rejected

Use `Accepted`, `Rejected`, or `Pending engineer review`.

If the engineer explicitly accepts the work, write `Accepted` and include a concise `Why` based on the verified outcome. If the engineer explicitly rejects the work, write `Rejected` and use the engineer's stated reason. If the engineer has not accepted or rejected the work yet, write `Pending engineer review`.

## Why

For accepted work, write a genuine one-sentence reason grounded in what changed or what verification passed. For rejected work, use the engineer's stated reason. For pending work, write `Awaiting engineer acceptance reason.` Do not use placeholder text such as `Pending engineer reason`.
