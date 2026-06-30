# Sample PR — AI review

## Summary

This documentation-only branch tightens the TaxPulse contribution and review workflow.
It updates the contributing guide, replaces ADR-0001 with the Tax Plan Cycle stage-only
condition decision, adds an ADR index, updates the default PR template, records local
sample AI-review evidence, and maintains the active prompt journal.

## Related ADR

ADR: [0001: Keep a Tax Plan Cycle&#39;s condition in its stage](../docs/adr/0001-tax-plan-cycle-stage-only-condition.md)

## Testing

- `rg "CONTRIBUTING.md|AGENTS.md|data-classification|300|500|type\\(optional-scope\\)" README.md CONTRIBUTING.md`
- `rg "Tax Plan Cycle|separate status|Alternatives considered|docs/adr/README.md" docs/adr README.md`
- `rg "AI code-review checklist|stage logic|typed boundaries|secrets|controlled data|ADR linked" .github/pull_request_template.md`
- `rg "Sample PR|AI output|What it missed|Acknowledgement gate|tenant|checklist|ADR" review/sample-pr-ai-review.md`
- `git diff --check`

## AI review evidence

AI review output:

> Codex review of the local `m1d4-implementation` documentation diff:
>
> - No blocking issues found in the documentation-only changes.
> - The ADR changes align with the TaxPulse workflow contract by documenting that a Tax Plan Cycle's condition lives in its workflow stage and that no separate status field should be added.
> - The ADR index makes future decisions discoverable from `docs/adr/README.md`, and the README now links to that index.
> - The pull request template now prompts reviewers to verify stage logic, typed boundaries, data-handling posture, test or verification evidence, AI-claim review, and ADR linking.
> - The contributing guide now gives enforceable branch naming, Conventional Commit, PR size, and review expectations.
> - The sample PR does not appear to introduce application behavior, secrets, credentials, real client data, tenant data, or controlled data.

What it missed:

> The AI output gave a false reassurance by saying the sample PR does not introduce tenant or controlled-data risk. That is true for this documentation-only diff, but it does not prove future implementation PRs preserve tenant isolation. A future code PR could still pass a superficial documentation review while leaking cross-tenant Tax Plan Cycle data or accepting untyped payloads.
>
> The checklist and a human reviewer catch this by requiring concrete yes/no verification: the diff must contain no secrets, real client data, tenant data, or controlled data; typed boundaries must remain in place; and any workflow change must prove that stage logic is role-gated and current-stage-gated. A reviewer should block merge when those claims are unsupported by the diff, tests, or documented verification.

## AI-tool reflection

I accepted Codex's suggestion to make ADR and checklist expectations explicit because it
makes review evidence easier to verify before merge. I rejected Codex's false reassurance
that a documentation-only review proves tenant isolation, because tenant isolation must be
checked in the actual implementation diff with typed boundaries, authorization behavior,
and data-handling evidence.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isiah Muli`.

## AI code-review checklist

- [X] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [X] Workflow changes keep stage transitions gated by role and current stage. No workflow code changed; this branch documents the rule in ADR-0001 and the PR checklist.
- [X] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns. This branch does not change application boundaries.
- [X] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [X] Tests or documented verification cover the changed behavior, including relevant negative paths. Verification is documentation-focused and listed above.
- [X] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [X] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [X] Summary explains what changed.
- [X] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [X] Testing lists only checks or verification actually performed.
- [X] AI code-review checklist is completed.
- [X] AI review output is pasted above as a quote or code block.
- [X] "What it missed" note is pasted above as a quote or code block.
- [X] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [X] PR is self-assigned in Assignees.
- [X] `Isiah Muli` is requested under Reviewers.

* The sample-PR AI-review output and your "what it missed" note as code/quote blocks
* **AI-tool reflection — one paragraph.** Name one suggestion Codex made that you *accepted* (and why) and one you *rejected* (and why).
* A deliverables checklist at the bottom of the PR description with each item above ticked off
* PR self-assigned (Assignees field); your ES requested under Reviewers
* The sample-PR AI-review output and your "what it missed" note as code/quote blocks
* **AI-tool reflection — one paragraph.** Name one suggestion Codex made that you *accepted* (and why) and one you *rejected* (and why).
* A deliverables checklist at the bottom of the PR description with each item above ticked off
* PR self-assigned (Assignees field); your ES requested under Reviewersd

