# TaxPulse Agent Instructions

## Project Purpose

TaxPulse is a multi-tenant SaaS for wealth-advisor firms that computes a client's real-time tax liability as advisors model scenarios.

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

Number entries sequentially in chronological order as `Entry 1`, `Entry 2`, `Entry 3`, and so on. Add each new entry after the previous one so the journal remains easy to scan.

## Asked

A concise summary of the prompt submitted to Codex.

## Produced

A concise summary of Codex's response or generated output.

## Accepted or rejected

Accepted or rejected.

## Why

The engineer's reasoning for the decision. Do not invent reasoning; ask for it if not provided. which i will type it
