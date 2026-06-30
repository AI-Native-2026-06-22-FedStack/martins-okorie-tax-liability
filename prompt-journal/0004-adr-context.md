dr

# Entry 1

Asked — Save the attached ADR-related context as a Markdown file and start a new prompt journal file for future entries.

Produced — Saved the attached context to `helper/week-2-adr-context.md` and created this new prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 2 ADR context is available in `helper/` and was used to guide the later ADR and PR-template work.

# Entry 2

Asked — Implement the process-documentation scaffold for contributing guidance, PR hygiene, ADRs, AI-review evidence, helper note organization, and the conventional-commit smoke test.

Produced — Added `CONTRIBUTING.md`, a pull request template, MADR ADR template, first ADR scaffold, sample AI-review evidence, moved course helper notes into `helper/`, and committed the documentation scaffold with a `docs:` Conventional Commit.

Accepted or rejected — Accepted.

Why — The scaffold files were created in the expected locations and the conventional-commit smoke test succeeded.

# Entry 3

Asked — Tighten `CONTRIBUTING.md` to document trunk-based branch naming, Conventional Commits, PR size and review expectations, guardrail links, and a README link, using the Week 2 ADR helper context.

Produced — Updated the contributing guide with enforceable branch, commit, and pull request rules; linked `AGENTS.md` and `docs/data-classification.md`; and added the README contribution link.

Accepted or rejected — Accepted.

Why — `CONTRIBUTING.md` now states enforceable workflow rules and the README links contributors to it.

# Entry 4

Asked — Add a MADR ADR template with alternatives considered, replace ADR-0001 with the Tax Plan Cycle stage-only condition decision, add an ADR index, and link the index from the README.

Produced — Updated `docs/adr/0000-template.md`, replaced the prior stack/governance ADR-0001 with `docs/adr/0001-tax-plan-cycle-stage-only-condition.md`, added `docs/adr/README.md`, and linked the ADR index from `README.md`.

Accepted or rejected — Accepted.

Why — ADR-0001 now records the stage-only condition decision and the ADR index is discoverable from the README.

# Entry 5

Asked — Update the repository-default pull request template with a TaxPulse-specific AI code-review checklist and ADR-link requirement, using the Week 2 ADR helper context.

Produced — Revised `.github/pull_request_template.md` with Summary, Related ADR, Testing, and AI code-review checklist sections, including checks for stage logic, typed boundaries, data handling, verification, AI-claim review, and ADR linking.

Accepted or rejected — Accepted.

Why — The repository-default PR template now contains the required TaxPulse AI code-review checklist and ADR-link gate.

# Entry 6

Asked — Create a local sample PR AI-review artifact from the current `m1d4-implementation` documentation diff, document what the AI review missed, and describe the future checklist acknowledgement gate, using the Week 2 ADR helper context.

Produced — Replaced `review/sample-pr-ai-review.md` with a structured local sample PR review, documented a false-reassurance issue about tenant isolation and controlled-data risk, explained how the checklist and a human reviewer catch it, and recorded that local artifact generation was selected because `gh` is unavailable.

Accepted or rejected — Accepted.

Why — The sample artifact names the accepted ADR/checklist-explicitness suggestion and rejects the false reassurance that documentation-only review proves tenant isolation.

# Entry 7

Asked — Add PR-template requirements for quoted AI-review evidence, AI-tool reflection, deliverables checklist, self-assignment, and requesting Isiah Muli as reviewer; update the sample review artifact accordingly.

Produced — Added AI review evidence, AI-tool reflection, PR routing, and deliverables checklist sections to `.github/pull_request_template.md`; converted sample AI output and missed-issue notes to quote blocks; and added an AI-tool reflection paragraph to the sample artifact.

Accepted or rejected — Accepted.

Why — The PR template and sample artifact now include quoted AI evidence, accepted/rejected AI-tool reflection, routing instructions, and a completed deliverables checklist.