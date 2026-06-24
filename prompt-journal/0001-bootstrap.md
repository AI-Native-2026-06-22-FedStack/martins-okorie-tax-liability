# Entry 1

Asked — Create a repo-level `config.toml` with predictable Codex defaults: medium reasoning effort, workspace-limited writes, and human approval for risky actions. Add the first prompt journal entry at `prompt-journal/0001-bootstrap.md`.

Produced — Added `config.toml` with `model_reasoning_effort = "medium"`, `sandbox_mode = "workspace-write"`, and `approval_policy = "on-request"`. Added this prompt journal entry.

Accepted or rejected — Accepted.

Why — The configuration matches the required guarded Codex posture: medium reasoning, workspace-limited writes, and human approval for risky actions.

# Entry 2

Asked — Update `AGENTS.md` with TaxPulse's purpose, data-handling rules, allowed and forbidden stacks, formatter and test-runner conventions, and domain vocabulary for real-time tax-liability work.

Produced — Added TaxPulse agent instructions covering project purpose, controlled-data handling, TypeScript/Express and Python/FastAPI standards, refusal rules for Java/Spring/JPA/Mongo, formatter and test conventions, and domain vocabulary for advisors, clients, and real-time tax-liability calculation.

Accepted or rejected — Accepted.

Why — The instructions capture TaxPulse's project rules clearly enough for future Codex sessions to enforce data handling, stack choices, and domain vocabulary.

# Entry 3

Asked — Prove the `AGENTS.md` contract is live by running a small scaffold prompt and confirming Codex emits TypeScript, not Java, while following documented conventions.

Produced — Added `evidence/0001-contract-live.md` and emitted TypeScript scaffold files under `evidence/scaffold/` showing the Java/Spring prompt was refused and converted into TypeScript/Express with synthetic fixtures and a Vitest-style test.

Accepted or rejected — Rejected forbidden stack; accepted the TypeScript/Express alternative.

Why — Java/Spring is forbidden by `AGENTS.md`, while TypeScript/Express is an allowed TaxPulse stack.

# Entry 4

Asked — Add `docs/data-classification.md` defining PUBLIC, CUI, and SBU; state the bright line that synthetic or PUBLIC data may enter prompts while real CUI/SBU data and secrets never do; explicitly classify TaxPulse client taxpayer and financial data as controlled; document least-privilege, no-secrets-in-code, forbidden committed artifacts, and a self-verify checklist. Bring the README up to standard with clean-clone initialization steps for a working, governed Codex session and links to `AGENTS.md` and the classification note.

Produced — Added the TaxPulse data classification note with prompt-handling rules, sensitive data examples, least-privilege expectations, no-secrets-in-code guidance, forbidden secret artifacts, and a new-engineer self-verify checklist. Expanded the README with governance links and exact setup commands for cloning, verifying required files, checking Codex posture, avoiding secret commits, and starting Codex from the repo root.

Accepted or rejected — Accepted.

Why — The docs now define the data posture and onboarding path a new engineer needs before using prompts or committing work.

# Entry 5

Asked — Create `evidence/guardrails-check.md` with a table containing the columns Step, prompt check, approval, and status. Include steps 1, 2, and 3 showing the approval-policy gate, redaction/non-echo behavior for synthetic sensitive-looking values, and allowed-stack behavior based on `AGENTS.md`.

Produced — Added `evidence/guardrails-check.md` with three guardrail proofs: an out-of-workspace write paused and was denied by approval policy, generated artifacts did not echo a synthetic sensitive-looking value, and a forbidden Java/Spring request was refused in favor of an allowed TypeScript/Express alternative.

Accepted or rejected — Accepted.

Why — The evidence demonstrates the guardrails with concrete checks for approval gating, non-echoing sensitive-looking input, and allowed-stack enforcement.

# Entry 6

Asked — Run a governance probe using `.codex/config.toml` by attempting an out-of-workspace command and denying approval, then confirm the approval policy paused the command.

Produced — Requested approval for an out-of-workspace write to the Desktop. The approval gate paused execution, the request was denied, and the probe file was not created. Also confirmed `.codex/config.toml` sets `sandbox_mode = "workspace-write"` and `approval_policy = "on-request"`.

Accepted or rejected — Rejected risky out-of-workspace command.

Why — The command was intentionally denied to prove the configured Codex posture pauses risky actions and does not run them without human approval.

# Entry 7

Asked — Stage the current TaxPulse governance work, commit it, push it to the current branch, and record this as the last prompt-journal entry.

Produced — Staged the repository changes, committed the governance documentation and evidence updates, and pushed the branch.

Accepted or rejected — Accepted.

Why — The governance artifacts were ready to preserve in git and share through the remote branch for review.
